import "dotenv/config"; // Please keep this line at the top of the file
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import pool, { dbHealth } from "./db.js";
import { dbViewerRoutes } from "./db-viewer.js";
import ticketsRoutes from "./routes/tickets.js";
import passwordRoutes from './routes/password.js';
import quoteRoutes from './routes/quotes.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { generalRateLimit, authRateLimit, passwordResetRateLimit } from './middleware/rateLimiter.js';
import roleRequestRoutes from './routes/roleRequests.js';

// --- Cookie helpers from .env ---
const envBool = (v, def=false) => {
  if (v === undefined) return def;
  const s = String(v).toLowerCase().trim();
  return ["1","true","yes","on"].includes(s);
};
const cookieSecure = envBool(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production");
const cookieDomain = (process.env.COOKIE_DOMAIN || "").trim() || undefined;

// SameSite values from env (fallbacks mirror your .env recommendations)
const sameSiteAccess = (process.env.COOKIE_SAME_SITE_ACCESS || "Lax");
const sameSiteRefresh = (process.env.COOKIE_SAME_SITE_REFRESH || "Strict");

// Reusable builder for legacy cookie (access-equivalent)
const buildAccessCookieOpts = () => ({
  httpOnly: true,
  sameSite: sameSiteAccess,     // <- use env
  secure: cookieSecure,         // <- use env
  domain: cookieDomain,         // <- use env (undefined in dev)
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});


// -------------------------------------------------------------------------------------
// Setup & constants
// -------------------------------------------------------------------------------------
const app = express();
if (process.env.NODE_ENV === "production") {
   app.set("trust proxy", 1);
}

app.use(cors({
  origin: (process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173']).map(s => s.trim()), // frontend URL
  credentials: true
})
);

app.use(express.json());
app.use(cookieParser());
// Apply general rate limiting to all requests
app.use('/api', generalRateLimit);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploaded files from a stable path (../uploads relative to backend/)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve demo page
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'session-demo.html'));
});

app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);      
app.use("/api/admin", adminRoutes);
app.use("/api/roles", roleRequestRoutes);      // users submit role requests here
app.use("/api/quotes", quoteRoutes);
app.use("/api/tickets", ticketsRoutes);

// DB viewer
dbViewerRoutes(app);

// -------------------------------------------------------------------------------------
// Legacy authentication (deprecated - keeping for backward compatibility)
// New auth routes use dual-token system in /api/auth/*
// -------------------------------------------------------------------------------------
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.cookie("token", token, buildAccessCookieOpts());
}

// -------------------------------------------------------------------------------------
// Favicon (avoid noisy 404s)
// -------------------------------------------------------------------------------------
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Root info page
app.get("/", (req, res) => {
  res.send(`
    <h1>🏢 Rawson Backend API</h1>
    <p>Building Management System Backend</p>
    <h2>Available Endpoints:</h2>
    <h3>🔐 Authentication (New Dual-Token System)</h3>
    <ul>
      <li>POST /api/auth/login - User authentication with dual tokens</li>
      <li>POST /api/auth/register - User registration with dual tokens</li>
      <li>GET /api/auth/me - Get current user (auto-refresh)</li>
      <li>POST /api/auth/refresh - Manually refresh tokens</li>
      <li>POST /api/auth/logout - Logout current session</li>
      <li>POST /api/auth/logout-all - Logout all user sessions</li>
      <li>GET /api/auth/sessions - List active sessions</li>
      <li>DELETE /api/auth/sessions/:id - Revoke specific session</li>
      <li>DELETE /api/auth/sessions - Revoke all other sessions</li>
    </ul>
    <h3>🎪 Demo & Testing</h3>
    <ul>
      <li><a href="/demo" target="_blank">🔐 Session Management Demo</a> - Interactive demo</li>
    </ul>
    <h3>📋 System</h3>
    <ul>
      <li><a href="/api/health">GET /api/health</a> - Database health check</li>
      <li><a href="/db-viewer">GET /db-viewer</a> - Web database viewer</li>
    </ul>
    <h3>⚠️ Legacy Auth (Deprecated)</h3>
    <ul>
      <li>POST /api/login - Old authentication (use /api/auth/login)</li>
      <li>POST /api/register - Old registration (use /api/auth/register)</li>
      <li>GET /api/me - Old session read (use /api/auth/me)</li>
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
// Auth: register (Legacy - use /api/auth/register instead)
// -------------------------------------------------------------------------------------
app.post("/api/register", authRateLimit, async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "Missing required fields: fullName, email, password" });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const hash = await bcrypt.hash(password, rounds);

    const role = "Client"; // default role

    const [result] = await pool.execute(
      "INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, hash, phone || null, role]
    );

    // Optional: auto-login on register
    setAuthCookie(res, { userId: result.insertId, role });

    return res.status(201).json({
      user: {
        userId: result.insertId,
        email,
        fullName,
        role,
      },
      message: "User registered successfully",
    });
  } catch (err) {
    console.error("Registration error:", err);
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "Server error during registration" });
  }
});

// -------------------------------------------------------------------------------------
// Auth: login (Legacy - use /api/auth/login instead)
// -------------------------------------------------------------------------------------
app.post("/api/login", authRateLimit, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Username and password are required" });
    }

    const [rows] = await pool.execute(
      "SELECT UserID, FullName, Email, PasswordHash, Role, Status FROM tblusers WHERE Email = ? LIMIT 1",
      [identifier]
    );

    if (!rows?.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    if (user.Status !== "Active") {
      return res.status(403).json({ message: `Account status is ${user.Status}` });
    }

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // Set cookie so frontend can call /api/me after refresh
    setAuthCookie(res, { userId: user.UserID, role: user.Role });

    return res.json({
      user: {
        userId: user.UserID,
        username: user.Email,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// -------------------------------------------------------------------------------------
// Auth: me (restore session)
// -------------------------------------------------------------------------------------
app.get("/api/me", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "No session" });

    const decoded = jwt.verify(token, JWT_SECRET);

    const [rows] = await pool.execute(
      "SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE UserID = ? LIMIT 1",
      [decoded.userId]
    );

    if (!rows?.length || rows[0].Status !== "Active") {
      return res.status(401).json({ message: "Invalid session" });
    }

    const u = rows[0];
    return res.json({
      user: {
        userId: u.UserID,
        username: u.Email,
        fullName: u.FullName,
        email: u.Email,
        role: u.Role,
      },
    });
  } catch (_e) {
    return res.status(401).json({ message: "Invalid session" });
  }
});

// -------------------------------------------------------------------------------------
// Auth: logout (clear cookie)
// -------------------------------------------------------------------------------------
app.post("/api/logout", (req, res) => {
  res.clearCookie("token", buildAccessCookieOpts());
  return res.json({ ok: true });
});

// -------------------------------------------------------------------------------------
// Legacy password reset endpoint (calls new auth system)
// -------------------------------------------------------------------------------------
app.post("/api/reset-password", passwordResetRateLimit, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Hash the token to find it in database
    const crypto = await import('crypto');
    const tokenHash = crypto.default.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const [rows] = await pool.execute(
      `SELECT pr.UserID, u.Email, u.FullName 
       FROM tblPasswordResets pr
       JOIN tblusers u ON pr.UserID = u.UserID
       WHERE pr.TokenHash = ? AND pr.ExpiresAt > NOW() AND pr.UsedAt IS NULL AND u.Status = 'Active'
       LIMIT 1`,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = rows[0];

    // Hash new password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password, rounds);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update password
      await connection.execute(
        'UPDATE tblusers SET PasswordHash = ? WHERE UserID = ?',
        [passwordHash, user.UserID]
      );

      // Mark reset token as used
      await connection.execute(
        'UPDATE tblPasswordResets SET UsedAt = NOW() WHERE TokenHash = ?',
        [tokenHash]
      );

      // Revoke all existing refresh tokens for security
      await connection.execute(
        'UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL',
        [user.UserID]
      );

      await connection.commit();
      return res.json({ message: 'Password has been reset successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ message: 'Server error during password reset' });
  }
});

// -------------------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;

const clientDistPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(clientDistPath));

// SPA fallback: anything not /api or /uploads goes to index.html
app.get(/^\/(?!api|uploads).*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});


app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
