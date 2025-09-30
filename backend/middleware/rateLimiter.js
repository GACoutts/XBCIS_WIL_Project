import rateLimit from 'express-rate-limit';

// General API rate limit
export const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 60000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10), // 20 attempts per window
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10) / 60000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
});

// Very strict rate limit for password reset
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin actions rate limit (more restrictive than general API)
export const adminRateLimit = rateLimit({
  windowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '50', 10), // 50 admin actions per window
  message: {
    error: 'Too many admin actions from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || '900000', 10) / 60000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
