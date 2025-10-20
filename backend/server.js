import "dotenv/config"; 
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import pool, { dbHealth } from "./db.js";
import { dbViewerRoutes } from "./db-viewer.js";
import { cleanupExpiredJtis } from './utils/tokens.js';
import fs from "fs";
// Import WhatsApp webhook route
import whatsappWebhook from './routes/whatsappWebhook.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

const envSuffix = process.env.NODE_ENV && process.env.NODE_ENV !== 'development'
  ? `.env.${process.env.NODE_ENV}`
  : null;

if (envSuffix) {
  const candidates = [
    path.resolve(process.cwd(), envSuffix),
    path.resolve(__dirname, envSuffix),       
    path.resolve(__dirname, '..', envSuffix),
  ];
  const envPath = candidates.find(p => fs.existsSync(p));
  if (envPath) {
    dotenv.config({ path: envPath, override: true });
    console.log(`[env] loaded ${envPath}`);
  }
}


// Routes
import ticketsRoutes from "./routes/tickets.js";
import passwordRoutes from './routes/password.js';
import quoteRoutes from './routes/quotes.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import roleRequestRoutes from './routes/roleRequests.js';
import landlordRoutes from './routes/landlord.js';
import notificationsRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';

// Middleware
import { generalRateLimit, passwordResetRateLimit } from './middleware/rateLimiter.js';

setInterval(async () => {
  try {
    const n = await cleanupExpiredJtis();
    if (n) console.log(`Cleaned ${n} expired revoked JTIs`);
  } catch (e) {
    console.warn('cleanupExpiredJtis error:', e?.message || e);
  }
}, 60 * 60 * 1000);

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

app.use('/api/webhooks/whatsapp', express.raw({ type: '*/*' }), (req, res, next) => {
  // save raw body for signature verification
  req.rawBody = req.body;
  next();
}, whatsappWebhook);

app.use(express.json());
app.use(cookieParser());

// Apply general rate limiting to all requests
app.use('/api', generalRateLimit);

// Serve quote PDFs with proper content type
app.use('/uploads/quotes', express.static(path.resolve(__dirname, 'uploads/quotes'), {
  dotfiles: 'deny',
  index: false,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.toLowerCase().endsWith('.pdf')) {
      res.type('application/pdf');
    }
  },
}));

// Serve job update photos
app.use('/uploads/job-updates', express.static(path.resolve(__dirname, 'uploads/job-updates'), {
  dotfiles: 'deny',
  index: false,
  maxAge: '1h'
}));

// Legacy uploads (general)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Stream proof files directly (supports nested paths like uploads/proofs/abc.pdf) ---
app.get('/api/admin/proofs/*', (req, res) => {
  try {
    // The wildcard after /api/admin/proofs/ -> e.g. "uploads/proofs/abc.pdf" or "proofs/abc.pdf"
    const raw = (req.params[0] || '').replace(/^\/+/, ''); // drop any leading slash

    if (!raw) return res.status(400).json({ message: 'Missing file path' });

    // Build a path under the uploads root, stripping an optional leading "uploads/"
    const uploadsRoot = path.resolve(__dirname, 'uploads');
    const rel = raw.replace(/^uploads\//, '');           // normalize "uploads/..." -> "..."
    const abs = path.resolve(uploadsRoot, rel);          // absolute file path under uploads/

    // Security: ensure resolved path stays within uploads/
    if (!abs.startsWith(uploadsRoot + path.sep) && abs !== uploadsRoot) {
      return res.status(400).json({ message: 'Invalid path' });
    }

    if (!fs.existsSync(abs)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.type(abs); // Express sets Content-Type from the file extension

    // Use sendFile with a callback so we can report fs errors cleanly
    res.sendFile(abs, (err) => {
      if (err) {
        console.error('sendFile error:', err);
        if (!res.headersSent) {
          return res.status(500).json({ message: 'Failed to load file' });
        }
      }
    });
  } catch (e) {
    console.error('proof stream error:', e);
    return res.status(500).json({ message: 'Failed to load file' });
  }
});


// -------------------------------------------------------------------------------------
// Routes
// -------------------------------------------------------------------------------------
app.use('/api/password', passwordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roles', roleRequestRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/landlord', landlordRoutes);

// Profile API for user settings
app.use('/api/profile', profileRoutes);

// Notifications API
app.use('/api/notifications', notificationsRoutes);

// DB viewer
dbViewerRoutes(app);

// Serve demo page
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'session-demo.html'));
});

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
    <h3> Authentication (New Dual-Token System)</h3>
    <ul>
      <li>POST /api/auth/login</li>
      <li>POST /api/auth/register</li>
      <li>GET /api/auth/me</li>
      <li>POST /api/auth/refresh</li>
      <li>POST /api/auth/logout</li>
      <li>DELETE /api/auth/sessions</li>
      <li>GET /api/auth/sessions</li>
      <li>DELETE /api/auth/sessions/:id</li>
      <li>DELETE /api/auth/sessions</li>
    </ul>
    <h3> Demo & Testing</h3>
    <ul>
      <li><a href="/demo" target="_blank"> Session Management Demo</a></li>
    </ul>
    <h3> Landlord API</h3>
    <ul>
      <li>GET /api/landlord/tickets - Get comprehensive ticket history with quotes and appointments</li>
      <li>GET /api/landlord/tickets/:ticketId/history</li>
      <li>GET /api/landlord/tickets/:ticketId/quotes</li>
      <li>GET /api/landlord/tickets/:ticketId/appointments</li>
      <li>POST /api/landlord/quotes/:quoteId/approve</li>
      <li>POST /api/landlord/quotes/:quoteId/reject</li>
    </ul>
    <h3> System</h3>
    <ul>
      <li>GET /api/health</li>
      <li>GET /db-viewer</li>
    </ul>
    <h3> Legacy Auth (Deprecated)</h3>
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

/*
// -------------------------------------------------------------------------------------
// Legacy auth (register/login/me/logout)
// -------------------------------------------------------------------------------------
app.post("/api/register", authRateLimit, async (req, res) => {
  try {
    const { fullName, email, password, phone, role } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ message: "Missing required fields" });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const hash = await bcrypt.hash(password, rounds);
    const userRole = role || "Client"; // Use provided role or default to Client

    // Set status to Inactive for all new users
    const [result] = await pool.execute(
      "INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role, Status) VALUES (?, ?, ?, ?, ?, ?)",
      [fullName, email, hash, phone || null, userRole, "Inactive"]
    );

    setAuthCookie(res, { userId: result.insertId, role: userRole });
    return res.status(201).json({ user: { userId: result.insertId, email, fullName, role: userRole }, message: "User registered successfully" });
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
*/

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
      await connection.execute('UPDATE tblRefreshTokens SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL', [user.UserID]); await connection.commit();
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

const clientDistPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(clientDistPath));

// SPA fallback: anything not /api or /uploads goes to index.html
app.get(/^\/(?!api|uploads).*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});


app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
