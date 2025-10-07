# Session Management System

This document describes the dual-token authentication system implemented in the Rawson Backend API.

## Overview

The system uses a modern **dual-token architecture** with:
- **Access Tokens**: Short-lived JWT tokens (20 minutes) for API requests
- **Refresh Tokens**: Long-lived, database-stored tokens (14 days) for session persistence

## Features

### 🔐 Security Features
- **Token Rotation**: Refresh tokens are rotated on each use
- **Token Revocation**: Granular session management with revocation
- **Token Reuse Detection**: Automatic family revocation on token reuse
- **Account Suspension Enforcement**: Suspended users cannot access any API endpoints
- **Enhanced Cookie Security**: HttpOnly, Secure, SameSite=Strict for all auth cookies
- **Admin Rate Limiting**: Dedicated rate limits for administrative actions
- **General Rate Limiting**: Configurable limits for authentication attempts
- **Audit Logging**: Complete audit trail of authentication events
- **Session Limits**: Configurable maximum sessions per user
- **Password Reset**: Secure token-based password reset flow

### 🎯 Session Management
- **Multi-Session Support**: Users can have multiple active sessions
- **Session Listing**: View all active sessions with device info
- **Selective Logout**: Revoke specific sessions or all sessions
- **Automatic Cleanup**: Expired tokens are automatically handled

## Database Schema

### Tables Created
1. **tblRefreshTokens**: Stores refresh tokens with metadata
2. **tblAuditLogs**: Logs all authentication events
3. **tblRevokedAccessJti**: Blacklist for revoked access tokens
4. **tblPasswordResets**: Secure password reset tokens

### Running Migrations
```bash
# Run all session system migrations
node scripts/run-migrations.js

# Verify tables were created
node scripts/verify-tables.js
```

## API Endpoints

### New Authentication Endpoints (Recommended)
```
POST   /api/auth/login                 - Login with dual tokens
POST   /api/auth/register              - Register with dual tokens  
GET    /api/auth/me                    - Get current user (auto-refresh)
POST   /api/auth/refresh               - Manually refresh tokens
POST   /api/auth/logout                - Logout current session
POST   /api/auth/logout-all            - Logout all sessions
GET    /api/auth/sessions              - List active sessions
DELETE /api/auth/sessions/:id          - Revoke specific session
DELETE /api/auth/sessions              - Revoke all other sessions
POST   /api/auth/request-password-reset - Request password reset
POST   /api/auth/reset-password        - Reset password with token
```

### Legacy Endpoints (Backward Compatibility)
```
POST   /api/login                      - Legacy login
POST   /api/register                   - Legacy register
GET    /api/me                         - Legacy session read
POST   /api/logout                     - Legacy logout
POST   /api/reset-password             - Legacy password reset
```

## Environment Configuration

### Required Environment Variables
```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=Rawson

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_ACCESS_EXPIRES=20m
JWT_REFRESH_EXPIRES=14d

# Security Configuration
BCRYPT_ROUNDS=12

# Cookie Security (HARDENED)
COOKIE_SECURE=true                    # Always true in production with HTTPS
COOKIE_SAME_SITE_ACCESS=strict       # Changed from 'lax' to 'strict' for security
COOKIE_SAME_SITE_REFRESH=strict      # Strict SameSite for both tokens
COOKIE_DOMAIN=                        # Leave empty for localhost

# Session Management
MAX_SESSIONS_PER_USER=5

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000           # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100           # General API limit
AUTH_RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
AUTH_RATE_LIMIT_MAX=20                # Auth attempts limit

# Admin Rate Limiting (NEW)
ADMIN_RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
ADMIN_RATE_LIMIT_MAX=50               # 50 admin actions per window

# Password Reset
APP_URL=http://localhost:5173         # Frontend URL for reset links
RESET_TOKEN_TTL_MIN=30                # Reset token validity in minutes

# SMTP Configuration (for password reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=no-reply@rawson.local
```

## Token Flow

### Login Flow
1. User provides credentials
2. Server validates credentials
3. Server generates access + refresh token pair
4. Both tokens set as HTTP-only cookies
5. Access token used for API requests
6. Refresh token stored in database with metadata

### Token Refresh Flow
1. Access token expires (20 minutes)
2. Client request fails with 401
3. Middleware automatically tries refresh
4. Old refresh token is revoked
5. New token pair is issued
6. Request retried with new access token

### Security Flow
1. **Token Reuse Detection**: If refresh token is reused, entire token family is revoked
2. **Session Limits**: Oldest sessions are revoked when limit is exceeded
3. **Audit Logging**: All auth events are logged with metadata

## Usage Examples

### Frontend Integration
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Protected request (tokens handled automatically)
const userResponse = await fetch('/api/auth/me', {
  credentials: 'include'
});

// List active sessions
const sessions = await fetch('/api/auth/sessions', {
  credentials: 'include'
});

// Logout all devices
await fetch('/api/auth/logout-all', {
  method: 'POST',
  credentials: 'include'
});
```

### Backend Middleware Usage
```javascript
import { requireAuth, hasRoleOrHigher } from './middleware/authMiddleware.js';

// Protect route - any authenticated user
app.get('/api/protected', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Role-based protection - Staff or higher
app.get('/api/admin', requireAuth, hasRoleOrHigher('Staff'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});
```

## Security Considerations

### Production Checklist

#### Security Hardening (Updated)
- [x] **Cookie Security**: HttpOnly, Secure, SameSite=Strict flags enabled
- [x] **Account Suspension**: Enforcement active in auth middleware
- [x] **Admin Rate Limiting**: Dedicated limits for staff actions
- [x] **Token Rotation**: Automatic rotation with reuse detection
- [ ] Set `COOKIE_SECURE=true` for HTTPS in production
- [ ] Configure proper CORS origins
- [ ] Use strong JWT secrets (32+ chars)
- [ ] Set up proper SMTP for password resets
- [ ] Configure rate limiting appropriately
- [ ] Monitor audit logs for suspicious activity
- [ ] Regular cleanup of expired tokens
- [ ] Database backups for token tables

#### SameSite=Strict Considerations
- **Cross-site requests**: SameSite=Strict prevents all cross-site cookie sending
- **External links**: Users clicking links from external sites will appear "logged out" initially
- **Embedded content**: May affect iframes or embedded components
- **Development**: Use COOKIE_SAME_SITE_ACCESS=lax for local development if needed

### Token Security
- Access tokens are stateless JWT tokens
- Refresh tokens are database-stored with hash verification
- All tokens include expiration times
- Revoked tokens are tracked in database
- Password reset tokens are single-use and time-limited

### Session Security
- Sessions are tied to IP and User-Agent for basic fingerprinting
- Session limits prevent resource exhaustion
- Audit logs provide complete authentication history
- Token families prevent replay attacks

## Troubleshooting

### Common Issues

**"Invalid session" errors**
- Check if access token expired and refresh failed
- Verify cookies are being sent (`credentials: 'include'`)
- Check if user account is still active

**Rate limit errors**
- Adjust `AUTH_RATE_LIMIT_MAX` if legitimate traffic is blocked
- Check for brute force attempts in audit logs

**Database connection issues**
- Verify environment variables are correct
- Run `node scripts/verify-tables.js` to check schema
- Check database permissions

### Monitoring
- Monitor `tblAuditLogs` for authentication patterns
- Watch for high rates of token refresh (possible attacks)
- Check session counts per user
- Monitor password reset request patterns

## Migration from Legacy Auth

The system maintains backward compatibility with existing JWT-only authentication:

1. **Phase 1**: Deploy dual-token system alongside legacy
2. **Phase 2**: Update frontend to use new endpoints
3. **Phase 3**: Monitor usage and deprecate legacy endpoints
4. **Phase 4**: Remove legacy authentication code

Both systems can run simultaneously during migration.
