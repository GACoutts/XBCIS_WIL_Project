# Security Features & Guidelines

This document outlines the security features implemented in the Rawson Building Management System and provides guidelines for maintaining security.

## 🔒 Implemented Security Features

### Authentication & Session Management
- **Dual-Token Architecture**: Short-lived access tokens (20 min) + long-lived refresh tokens (14 days)
- **Token Rotation**: Refresh tokens automatically rotate on each use
- **Token Reuse Detection**: Automatic family revocation if refresh token is reused
- **Session Management**: Multi-session support with selective logout capabilities
- **Account Suspension Enforcement**: Suspended users cannot access any API endpoints

### Cookie Security (HARDENED)
- **HttpOnly**: All auth cookies are HttpOnly (not accessible via JavaScript)
- **Secure**: Cookies only sent over HTTPS in production
- **SameSite=Strict**: Maximum protection against CSRF attacks
- **Domain Scoped**: Cookies properly scoped to application domain

### Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 20 login attempts per 15 minutes per IP
- **Admin Actions**: 50 admin operations per 15 minutes per IP (NEW)
- **Password Reset**: 5 reset attempts per hour per IP

### Access Control
- **Role-Based Access Control (RBAC)**: Four user roles with hierarchical permissions
- **Route Protection**: All sensitive routes protected with authentication middleware
- **Account Status Enforcement**: Only 'Active' users can access the system
- **Permission Isolation**: Users can only access data they're authorized for

### Audit & Monitoring
- **Comprehensive Audit Logging**: All authentication events tracked
- **Session Tracking**: Device and IP information stored for each session
- **Token Blacklisting**: Revoked access tokens tracked until expiration

## 🛡️ Rate Limits Summary

| Endpoint Type | Limit | Window | Purpose |
|---------------|-------|---------|----------|
| General API | 100 requests | 15 minutes | Prevent API abuse |
| Authentication | 20 attempts | 15 minutes | Prevent brute force |
| Admin Actions | 50 operations | 15 minutes | Protect staff functions |
| Password Reset | 5 attempts | 1 hour | Prevent reset abuse |

## 🚨 Account Status Enforcement

The system enforces user account status at multiple levels:

### Account Statuses
- **Active**: Full system access
- **Inactive**: Cannot login or access APIs
- **Suspended**: Cannot login or access APIs (staff action)
- **Rejected**: Cannot login or access APIs (staff action)

### Enforcement Points
1. **Login**: Only 'Active' users can obtain new sessions
2. **API Access**: All API requests check user status in real-time
3. **Token Refresh**: Status checked during token rotation
4. **Session Validity**: Active sessions invalidated when user suspended

## 🍪 Cookie Security Details

### SameSite=Strict Implementation
Our cookies use `SameSite=Strict` for maximum security:

**Benefits:**
- Complete protection against CSRF attacks
- Cookies never sent on cross-site requests
- Highest level of cookie security

**Considerations:**
- Users appear "logged out" when arriving from external links
- May affect embedded content or iframes
- Can impact user experience in some scenarios

**Development Override:**
```env
COOKIE_SAME_SITE_ACCESS=lax  # Use only for local development
```

## 📋 Security Testing Checklist

### Cookie Security Tests
- [ ] Verify cookies have HttpOnly flag
- [ ] Verify cookies have Secure flag (production)
- [ ] Verify cookies have SameSite=Strict
- [ ] Test cookies not accessible via JavaScript (`document.cookie`)

### Account Status Tests
- [ ] Create test user and suspend account
- [ ] Verify suspended user cannot login
- [ ] Verify active session invalidated when user suspended
- [ ] Test proper error messages for different statuses

### Token Security Tests
- [ ] Verify refresh tokens rotate on use
- [ ] Test token reuse detection triggers family revocation
- [ ] Verify logout-all clears all user sessions
- [ ] Test access token revocation on logout

### Rate Limiting Tests
- [ ] Test general API rate limiting
- [ ] Test auth rate limiting with rapid login attempts
- [ ] Test admin rate limiting with rapid admin calls
- [ ] Verify proper rate limit headers and error messages

### Authorization Tests
- [ ] Test role-based access control
- [ ] Verify users cannot access other users' data
- [ ] Test privilege escalation prevention
- [ ] Verify admin functions properly restricted

## 🔧 Security Configuration

### Required Environment Variables
```env
# Security Hardening
COOKIE_SECURE=true                    # Always true in production
COOKIE_SAME_SITE_ACCESS=strict       # Strict for security
COOKIE_SAME_SITE_REFRESH=strict      # Strict for both tokens

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # General API limit
AUTH_RATE_LIMIT_MAX=20               # Auth attempts
ADMIN_RATE_LIMIT_MAX=50              # Admin actions

# JWT Security
JWT_SECRET=your-super-secure-32-char-secret
JWT_ACCESS_EXPIRES=20m               # Short-lived access tokens
JWT_REFRESH_EXPIRES=14d              # Long-lived refresh tokens

# Password Security
BCRYPT_ROUNDS=12                     # Strong password hashing
```

### Production Deployment Security

#### Infrastructure Security
- [ ] Use HTTPS everywhere (TLS 1.2 minimum)
- [ ] Implement proper firewall rules
- [ ] Use environment variables for secrets
- [ ] Enable database connection encryption
- [ ] Set up log monitoring and alerting

#### Application Security
- [ ] Use strong, unique JWT secrets (32+ characters)
- [ ] Enable all rate limiting features
- [ ] Configure proper CORS origins
- [ ] Set up automated security scanning
- [ ] Implement regular security audits

#### Monitoring & Alerting
- [ ] Monitor failed login attempts
- [ ] Alert on suspicious session patterns
- [ ] Track admin action anomalies
- [ ] Regular audit log reviews
- [ ] Database backup verification

## 🚨 Security Incident Response

### Immediate Actions
1. **Account Compromise**: Suspend affected user account immediately
2. **Token Compromise**: Use admin tools to revoke all user sessions
3. **Rate Limit Bypass**: Check logs and adjust limits if needed
4. **Database Access**: Review audit logs for unauthorized access

### Investigation Steps
1. Review audit logs for suspicious activity
2. Check session management logs for anomalies
3. Analyze rate limiting logs for patterns
4. Verify user account status changes
5. Document findings and corrective actions

## 🔍 Regular Security Audits

### Weekly Tasks
- [ ] Review failed authentication attempts
- [ ] Check for suspended/inactive user login attempts
- [ ] Monitor rate limiting trigger patterns
- [ ] Verify backup integrity

### Monthly Tasks
- [ ] Review user access permissions
- [ ] Audit admin account activities
- [ ] Check for expired tokens cleanup
- [ ] Update security dependencies

### Quarterly Tasks
- [ ] Full security configuration review
- [ ] Penetration testing (if applicable)
- [ ] Security training updates
- [ ] Incident response plan review

## 📚 Security Resources

### Documentation
- [SESSION_MANAGEMENT.md](backend/docs/SESSION_MANAGEMENT.md) - Detailed auth system documentation
- [Database Schema](database/sql/) - Database security features
- [API Documentation](docs/) - Endpoint security details

### External Resources
- [OWASP Security Guidelines](https://owasp.org/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Cookie Security Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

## 🔄 Security Updates

This document should be updated whenever:
- New security features are implemented
- Security vulnerabilities are discovered and patched
- Rate limiting policies are changed
- Authentication mechanisms are modified
- New compliance requirements are identified

---

**Last Updated**: 2025-01-30  
**Security Contact**: System Administrator  
**Emergency Contact**: [Define emergency contact process]