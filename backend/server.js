import "dotenv/config"; // keep at top
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import pool, { dbHealth } from "./db.js";
import { dbViewerRoutes } from "./db-viewer.js";

// Routes
import ticketsRoutes from "./routes/tickets.js";
import passwordRoutes from './routes/password.js';
import quoteRoutes from './routes/quotes.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import roleRequestRoutes from './routes/roleRequests.js';
import landlordRoutes from './routes/landlord.js';

// Middleware
import { generalRateLimit, authRateLimit, passwordResetRateLimit } from './middleware/rateLimiter.js';

// -------------------------------------------------------------------------------------
// Setup & constants
// -------------------------------------------------------------------------------------
const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // your frontend URL
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Apply general rate limiting to all requests
app.use('/api', generalRateLimit);

// Serve uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -------------------------------------------------------------------------------------
// Routes
// -------------------------------------------------------------------------------------
app.use('/api', passwordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roles', roleRequestRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/landlord', landlordRoutes);

// DB viewer
dbViewerRoutes(app);

// Serve demo page
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'session-demo.html'));
});

// -------------------------------------------------------------------------------------
// JWT Cookie Helpers
// -------------------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// -------------------------------------------------------------------------------------
// Favicon (avoid noisy 404s)
// -------------------------------------------------------------------------------------
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// -------------------------------------------------------------------------------------
// Root info page
// -------------------------------------------------------------------------------------
app.get("/", (_req, res) => {
  res.send(`
    <h1>🏢 Rawson Backend API</h1>
    <p>Building Management System Backend</p>
    <h2>Available Endpoints:</h2>
    <h3>🔐 Authentication (New Dual-Token System)</h3>
    <ul>
      <li>POST /api/auth/login</li>
      <li>POST /api/auth/register</li>
      <li>GET /api/auth/me</li>
      <li>POST /api/auth/refresh</li>
      <li>POST /api/auth/logout</li>
      <li>POST /api/auth/logout-all</li>
      <li>GET /api/auth/sessions</li>
      <li>DELETE /api/auth/sessions/:id</li>
      <li>DELETE /api/auth/sessions</li>
    </ul>
    <h3>🎪 Demo & Testing</h3>
    <ul>
      <li><a href="/demo" target="_blank">🔐 Session Management Demo</a></li>
    </ul>
    <h3>🏠 Landlord API</h3>
    <ul>
      <li>GET /api/landlord/tickets - Get comprehensive ticket history with quotes and appointments</li>
      <li>GET /api/landlord/tickets/:ticketId/history</li>
      <li>GET /api/landlord/tickets/:ticketId/quotes</li>
      <li>GET /api/landlord/tickets/:ticketId/appointments</li>
      <li>POST /api/landlord/quotes/:quoteId/approve</li>
      <li>POST /api/landlord/quotes/:quoteId/reject</li>
    </ul>
    <h3>📋 System</h3>
    <ul>
      <li>GET /api/health</li>
      <li>GET /db-viewer</li>
    </ul>
    <h3>⚠️ Legacy Auth (Deprecated)</h3>
    <ul>
      <li>POST /api/login</li>
      <li>POST /api/register</li>
      <li>GET /api/me</li>
    </ul>
  `);
});

// -------------------------------------------------------------------------------------
// Health check
// -------------------------------------------------------------------------------------
app.get("/api/health", async (_req, res) => {
  try {
    const ok = await dbHealth();
    return ok
      ? res.json({ status: "healthy", database: "connected" })
      : res.status(500).json({ status: "unhealthy", database: "disconnected" });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// -------------------------------------------------------------------------------------
// Legacy auth (register/login/me/logout)
// -------------------------------------------------------------------------------------
app.post("/api/register", authRateLimit, async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ message: "Missing required fields" });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const hash = await bcrypt.hash(password, rounds);
    const role = "Client";

    const [result] = await pool.execute(
      "INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, hash, phone || null, role]
    );

    setAuthCookie(res, { userId: result.insertId, role });
    return res.status(201).json({ user: { userId: result.insertId, email, fullName, role }, message: "User registered successfully" });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email already exists" });
    console.error(err);
    return res.status(500).json({ message: "Server error during registration" });
  }
});

app.post("/api/login", authRateLimit, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;
    if (!identifier || !password) return res.status(400).json({ message: "Email/Username and password required" });

    const [rows] = await pool.execute(
      "SELECT UserID, FullName, Email, PasswordHash, Role, Status FROM tblusers WHERE Email = ? LIMIT 1",
      [identifier]
    );

    if (!rows?.length) return res.status(401).json({ message: "Invalid credentials" });
    const user = rows[0];
    if (user.Status !== "Active") return res.status(403).json({ message: `Account status is ${user.Status}` });

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    setAuthCookie(res, { userId: user.UserID, role: user.Role });
    return res.json({ user: { userId: user.UserID, username: user.Email, fullName: user.FullName, email: user.Email, role: user.Role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "No session" });
    const decoded = jwt.verify(token, JWT_SECRET);

    const [rows] = await pool.execute(
      "SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1",
      [decoded.userId]
    );

    if (!rows?.length || rows[0].Status !== "Active") return res.status(401).json({ message: "Invalid session" });
    const u = rows[0];
    return res.json({ user: { userId: u.UserID, username: u.Email, fullName: u.FullName, email: u.Email, role: u.Role } });
  } catch (_e) {
    return res.status(401).json({ message: "Invalid session" });
  }
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie("token", { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === 'production' });
  return res.json({ ok: true });
});

// -------------------------------------------------------------------------------------
// Password reset (legacy)
// -------------------------------------------------------------------------------------
app.post("/api/reset-password", passwordResetRateLimit, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and new password required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const crypto = await import('crypto');
    const tokenHash = crypto.default.createHash('sha256').update(token).digest('hex');

    const [rows] = await pool.execute(
      `SELECT pr.UserID, u.Email, u.FullName
       FROM tblPasswordResets pr
       JOIN tblusers u ON pr.UserID = u.UserID
       WHERE pr.TokenHash = ? AND pr.ExpiresAt > NOW() AND pr.UsedAt IS NULL AND u.Status = 'Active'
       LIMIT 1`,
      [tokenHash]
    );

    if (!rows.length) return res.status(400).json({ message: "Invalid or expired reset token" });
    const user = rows[0];

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password, rounds);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE tblusers SET PasswordHash = ? WHERE UserID = ?', [passwordHash, user.UserID]);
      await connection.execute('UPDATE tblPasswordResets SET UsedAt = NOW() WHERE TokenHash = ?', [tokenHash]);
      await connection.execute('UPDATE tblRefreshTokens SET RevokedAt = NOW WHERE UserID = ? AND RevokedAt IS NULL', [user.UserID]);
      await connection.commit();
      return res.json({ message: "Password has been reset successfully" });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during password reset" });
  }
});

// -------------------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
