# Password Reset Test Instructions

## 🔧 Current Status
✅ Backend running on http://localhost:5000
✅ Frontend running on http://localhost:5173
✅ Database table created
✅ Test user exists: test@example.com
✅ SMTP configured with Ethereal Email

## 📧 Email Credentials for Testing
- **View emails at**: https://ethereal.email/login
- **Username**: bqknqkslyutekcgr@ethereal.email
- **Password**: DpGhpKN9hwKsEGNQrE

## 🧪 Complete Test Flow

### Method 1: Frontend UI Test
1. **Visit the login page**: http://localhost:5173/login
2. **Click "Forgot password?" link**
3. **Enter email**: test@example.com
4. **Submit form**
5. **Check for success message**
6. **Go to Ethereal Email** to view the reset email
7. **Click the reset link** in the email
8. **Set new password** (min 8 characters)
9. **Test login** with new password

### Method 2: API Test (Manual)
```powershell
# Test forgot password
$body = @{ email = "test@example.com" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:5000/api/forgot-password -Method POST -Body $body -ContentType "application/json"

# Check backend console for debug output showing:
# - Email being sent
# - Reset URL generated
# - Preview URL for Ethereal Email
```

### Method 3: Direct Reset URL Test
If you get the token from the backend console logs, you can test directly:
```
http://localhost:5173/reset-password?token=YOUR_TOKEN_HERE
```

## 🔍 What to Look For

### Success Indicators:
- ✅ API returns 200 status
- ✅ Generic success message shown
- ✅ Backend console shows email debug logs
- ✅ Email appears in Ethereal Email
- ✅ Reset URL works and shows password form
- ✅ New password can be set
- ✅ Login works with new password

### Common Issues:
- ❌ CORS errors (should be fixed)
- ❌ SSL certificate errors (should be fixed)
- ❌ Email not sending (check backend logs)
- ❌ Token not found in database
- ❌ Frontend not connecting to backend

## 🚀 Quick Test Commands
```powershell
# Test backend health
Invoke-WebRequest -Uri http://localhost:5000/api/health

# Test password reset
$body = @{ email = "test@example.com" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:5000/api/forgot-password -Method POST -Body $body -ContentType "application/json"
```

## 📝 Expected Behavior
1. **Forgot Password**: Always returns success message (security)
2. **Email Sending**: Real email sent to Ethereal Email for testing
3. **Reset Token**: 30-minute expiration, single use
4. **Password Reset**: Requires valid token + new password
5. **Security**: Tokens are hashed in database, original token in URL

## 🎯 Success Criteria
- [ ] Frontend loads without errors
- [ ] Forgot password form works
- [ ] Email is received in Ethereal
- [ ] Reset link works
- [ ] New password can be set
- [ ] Login works with new password
