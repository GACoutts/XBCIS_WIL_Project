import express from "express";
import cors from "cors";
import bcrypt from 'bcrypt';
import pool, { dbHealth } from './db.js';
import { dbViewerRoutes } from './db-viewer.js';
import ticketsRoutes from './routes/tickets.js';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/tickets', ticketsRoutes);

// Add database viewer routes
dbViewerRoutes(app);

// Favicon route to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content response
});

// Root route
app.get('/', (req, res) => {
  res.send(`
    <h1>🏢 Rawson Backend API</h1>
    <p>Building Management System Backend</p>
    <h2>Available Endpoints:</h2>
    <ul>
      <li><a href="/api/health">GET /api/health</a> - Database health check</li>
      <li><a href="/db-viewer">GET /db-viewer</a> - Web database viewer</li>
      <li>POST /api/login - User authentication</li>
      <li>POST /api/register - User registration</li>
      <li>GET /api/db/tables - List database tables</li>
    </ul>
    <p><strong>Database Status:</strong> Connected ✅</p>
    <p><strong>Admin Login:</strong> admin@rawson.local / Password123!</p>
  `);
});

// Database health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const isHealthy = await dbHealth();
    if (isHealthy) {
      return res.json({ status: "healthy", database: "connected" });
    } else {
      return res.status(500).json({ status: "unhealthy", database: "disconnected" });
    }
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, password, phone, role } = req.body;
    
    // Validate required fields
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields: fullName, email, password, role' });
    }
    
    // Validate role
    const validRoles = ['Client', 'Landlord', 'Contractor', 'Staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be one of: ' + validRoles.join(', ') });
    }
    
    // Hash password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = await bcrypt.hash(password, rounds);
    
    // Insert user into database
    const [result] = await pool.execute(
      'INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, hash, phone || null, role]
    );
    
    return res.status(201).json({ 
      userId: result.insertId, 
      email, 
      fullName, 
      role,
      message: 'User registered successfully'
    });
    
  } catch (err) {
    console.error('Registration error:', err);
    
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// User login endpoint
app.post('/api/login', async (req, res) => {
  try {
    // Accept either email or username field for compatibility with existing frontend
    const { email, username, password } = req.body;
    const identifier = email || username;
    
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/Username and password are required' });
    }
    
    // Get user from database
    const [rows] = await pool.execute(
      'SELECT UserID, FullName, Email, PasswordHash, Role, Status FROM tblusers WHERE Email = ? LIMIT 1',
      [identifier]
    );
    
    if (!rows?.length) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = rows[0];
    
    // Check user status
    if (user.Status !== 'Active') {
      return res.status(403).json({ message: `Account status is ${user.Status}` });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Return user data (exclude password hash)
    return res.json({
      userId: user.UserID,
      username: user.Email, // for compatibility with frontend
      fullName: user.FullName,
      email: user.Email,
      role: user.Role
    });
    
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend running on :) http://localhost:${PORT}`);
});
