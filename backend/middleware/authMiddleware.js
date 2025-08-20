// backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid session" });
  }
}
