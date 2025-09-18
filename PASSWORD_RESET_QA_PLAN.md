# 🔐 Password Reset QA Testing Plan

## 📋 Prerequisites Setup

### 1. Environment Configuration
Before starting tests, ensure your `.env` file has valid SMTP settings:

```env
# SMTP Configuration (Required for email sending)
SMTP_HOST=smtp.ethereal.email  # or your SMTP provider
SMTP_PORT=587
SMTP_USER=your-test-email@ethereal.email
SMTP_PASS=your-test-password
SMTP_FROM=no-reply@rawson.local

# Password Reset Configuration
RESET_TOKEN_TTL_MIN=30  # Token expires after 30 minutes
APP_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-db-password
DB_NAME=rawson
```

### 2. Database Setup
```bash
# Ensure you have test users in the database
mysql -u root -p rawson < database/seeds/team-sync-users.sql

# Verify users exist
mysql -u root -p -e "USE rawson; SELECT UserID, Email, Role FROM tblusers WHERE Email LIKE '%@demo.com';"
```

### 3. Server Dependencies
```bash
# Install dependencies
cd backend && npm install

# Start backend server
npm run dev
```

---

## 🧪 Test Cases

### **Test 1: Valid Email Flow** ✅
**Objective:** Test complete forgot password to reset flow with valid email

**Steps:**
1. Navigate to `http://localhost:5173/forgot-password`
2. Enter valid email: `client@demo.com`
3. Click "Send reset link"
4. Check console logs for email sending confirmation
5. Copy reset URL from console logs
6. Navigate to the reset URL
7. Enter new password (min 8 characters)
8. Confirm password matches
9. Click "Reset password"
10. Wait for redirect to login page
11. Test login with new password

**Expected Results:**
- ✅ Success message: "If your email is registered, a reset link has been sent"
- ✅ Console shows: "Email sent successfully" with message ID
- ✅ Reset form loads correctly
- ✅ Password reset succeeds
- ✅ Login works with new password
- ✅ Database shows token marked as used

**SQL Verification:**
```sql
-- Check that token was created and used
SELECT TokenID, UserID, CreatedAt, ExpiresAt, UsedAt 
FROM tblPasswordResetTokens 
WHERE UserID = (SELECT UserID FROM tblusers WHERE Email = 'client@demo.com')
ORDER BY CreatedAt DESC LIMIT 1;

-- Verify password was updated (PasswordHash should be different)
SELECT UserID, Email, PasswordHash FROM tblusers WHERE Email = 'client@demo.com';
```

---

### **Test 2: Invalid Email (Security)** 🔒
**Objective:** Ensure system doesn't reveal if email exists

**Steps:**
1. Navigate to `http://localhost:5173/forgot-password`
2. Enter non-existent email: `nonexistent@example.com`
3. Click "Send reset link"

**Expected Results:**
- ✅ Same generic success message (doesn't reveal email doesn't exist)
- ✅ No email sent (check console logs)
- ✅ No token created in database

**SQL Verification:**
```sql
-- Should return 0 rows
SELECT COUNT(*) FROM tblPasswordResetTokens 
WHERE UserID IN (SELECT UserID FROM tblusers WHERE Email = 'nonexistent@example.com');
```

---

### **Test 3: Token Expiry** ⏰
**Objective:** Verify expired tokens are rejected

**Method 1 - Database Manipulation:**
1. Request password reset for `landlord@demo.com`
2. Copy token from console URL
3. Manually expire the token in database:
```sql
UPDATE tblPasswordResetTokens 
SET ExpiresAt = DATE_SUB(NOW(), INTERVAL 1 HOUR)
WHERE TokenHash = SHA2('your-token-here', 256);
```
4. Try to use the reset link

**Method 2 - Wait for Natural Expiry:**
1. Set `RESET_TOKEN_TTL_MIN=1` in `.env`
2. Restart server
3. Request reset link
4. Wait 2+ minutes
5. Try to use the link

**Expected Results:**
- ✅ Error message: "Invalid or expired reset link"
- ✅ Password reset form shows error
- ✅ No password change occurs

---

### **Test 4: Server Restart Cleanup** 🔄
**Objective:** Test that expired tokens are cleaned up when server restarts

**Steps:**
1. Create a reset token:
```bash
curl -X POST http://localhost:5000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"contractor@demo.com"}'
```

2. Stop the server (Ctrl+C)

3. Manually expire the token in database:
```sql
UPDATE tblPasswordResetTokens 
SET ExpiresAt = DATE_SUB(NOW(), INTERVAL 1 HOUR)
WHERE UserID = (SELECT UserID FROM tblusers WHERE Email = 'contractor@demo.com')
AND UsedAt IS NULL;
```

4. Start the server again:
```bash
npm run dev
```

5. Check server logs for cleanup messages

6. Verify token is marked as used:
```sql
SELECT TokenID, ExpiresAt, UsedAt FROM tblPasswordResetTokens 
WHERE UserID = (SELECT UserID FROM tblusers WHERE Email = 'contractor@demo.com')
ORDER BY CreatedAt DESC LIMIT 1;
```

**Expected Results:**
- ✅ Server logs show: "🧹 Starting expired token cleanup..."
- ✅ Server logs show: "✅ Cleaned up X expired password reset tokens"
- ✅ Database shows expired token marked as used (UsedAt = NOW())

---

### **Test 5: Multiple Reset Requests** 🔁
**Objective:** Test behavior with multiple reset requests for same user

**Steps:**
1. Request reset for `staff@demo.com`
2. Immediately request another reset for same email
3. Check database for tokens
4. Use the second (most recent) token
5. Try to use the first token

**Expected Results:**
- ✅ First token is invalidated when second is created
- ✅ Only the latest token works
- ✅ First token shows "Invalid or expired reset link"

**SQL Verification:**
```sql
SELECT TokenID, CreatedAt, ExpiresAt, UsedAt 
FROM tblPasswordResetTokens 
WHERE UserID = (SELECT UserID FROM tblusers WHERE Email = 'staff@demo.com')
ORDER BY CreatedAt DESC LIMIT 5;
```

---

### **Test 6: Malformed Requests** 🚨
**Objective:** Test API handles invalid requests properly

**Test Cases:**
```bash
# Empty email
curl -X POST http://localhost:5000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":""}'

# No email field
curl -X POST http://localhost:5000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{}'

# Invalid email format
curl -X POST http://localhost:5000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email"}'

# Empty token
curl -X POST http://localhost:5000/api/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"", "password":"newpass123"}'

# Short password
curl -X POST http://localhost:5000/api/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"valid-token", "password":"short"}'
```

**Expected Results:**
- ✅ Proper error messages for each case
- ✅ No server crashes
- ✅ No tokens created for invalid requests

---

### **Test 7: UI/UX Validation** 💻
**Objective:** Test frontend form validations and user experience

**Forgot Password Form:**
1. Submit empty form
2. Submit invalid email format
3. Submit valid email
4. Check loading states and error messages

**Reset Password Form:**
1. Navigate without token parameter
2. Submit with password mismatch
3. Submit with short password
4. Submit with valid data
5. Test keyboard navigation (Enter key)

**Expected Results:**
- ✅ Client-side validation prevents invalid submissions
- ✅ Error messages are user-friendly
- ✅ Success states are clear
- ✅ Loading states prevent double-submission

---

## 🔧 Manual Testing Tools

### Email Testing (if using Ethereal)
- **Ethereal Email**: https://ethereal.email
- Login with your SMTP credentials to see sent emails
- Preview URLs are logged to console

### Database Monitoring Queries
```sql
-- Active reset tokens
SELECT 
  t.TokenID,
  u.Email,
  t.CreatedAt,
  t.ExpiresAt,
  t.UsedAt,
  CASE 
    WHEN t.ExpiresAt < NOW() THEN 'EXPIRED'
    WHEN t.UsedAt IS NOT NULL THEN 'USED'
    ELSE 'ACTIVE'
  END as Status
FROM tblPasswordResetTokens t
JOIN tblusers u ON t.UserID = u.UserID
ORDER BY t.CreatedAt DESC
LIMIT 10;

-- Reset token statistics
SELECT 
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN UsedAt IS NOT NULL THEN 1 END) as used_tokens,
  COUNT(CASE WHEN ExpiresAt < NOW() AND UsedAt IS NULL THEN 1 END) as expired_tokens,
  COUNT(CASE WHEN ExpiresAt > NOW() AND UsedAt IS NULL THEN 1 END) as active_tokens
FROM tblPasswordResetTokens;
```

---

## ✅ Acceptance Criteria

Password Reset is ready for production when:

- [ ] All 7 test cases pass
- [ ] SMTP configuration works with real email provider
- [ ] Expired tokens are cleaned up on server restart
- [ ] Security: No email enumeration possible
- [ ] UI provides clear feedback at each step
- [ ] Database cleanup prevents token table bloat
- [ ] Error handling is comprehensive and user-friendly
- [ ] Performance: Reset process completes in <5 seconds
- [ ] Logging: All password reset events are properly logged

---

## 🐛 Common Issues & Debugging

### SMTP Issues
```bash
# Test SMTP connection
node backend/scripts/test-email.js
```

### Database Connection
```bash
# Test database health
curl http://localhost:5000/api/health
```

### Token Generation
- Tokens use SHA-256 hashing
- Raw tokens are 64 hex characters
- Check console logs for debug information

### Server Cleanup Not Running
- Verify import statement in `server.js`
- Check for async/await in server startup
- Look for cleanup logs on server start