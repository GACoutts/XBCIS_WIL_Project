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
import "dotenv/config";

// -------------------------------------------------------------------------------------
// Setup & constants
// -------------------------------------------------------------------------------------
const app = express();
app.use(cors());            // Vite proxy keeps same-origin in dev, this is fine
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploaded files from a stable path (../uploads relative to backend/)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API routes
app.use("/api/tickets", ticketsRoutes);

// DB viewer
dbViewerRoutes(app);

// -------------------------------------------------------------------------------------
// Utility: issue a cookie token and return minimal user object
// -------------------------------------------------------------------------------------
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  // In dev (http://localhost) use secure:false. In production behind HTTPS set secure:true.
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // keep aligned with JWT_EXPIRES
    path: "/",
  });
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
    <ul>
      <li><a href="/api/health">GET /api/health</a> - Database health check</li>
      <li><a href="/db-viewer">GET /db-viewer</a> - Web database viewer</li>
      <li>POST /api/login - User authentication</li>
      <li>POST /api/register - User registration</li>
      <li>GET /api/me - Read current session</li>
      <li>POST /api/logout - Clear session</li>
      <li>GET /api/db/tables - List database tables</li>
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
// Auth: register
// -------------------------------------------------------------------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { fullName, email, password, phone, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Missing required fields: fullName, email, password, role" });
    }

    const validRoles = ["Client", "Landlord", "Contractor", "Staff"];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Must be one of: " + validRoles.join(", ") });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const hash = await bcrypt.hash(password, rounds);

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
// Auth: login (sets cookie)
// -------------------------------------------------------------------------------------
app.post("/api/login", async (req, res) => {
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
  res.clearCookie("token", { path: "/", sameSite: "lax" });
  return res.json({ ok: true });
});

// -------------------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
