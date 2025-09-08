# 🎓 WIL Project Presentation Setup

## 🚀 Quick Start for Tomorrow's Presentation

### 1. **Seed Demo Data**
```bash
cd backend
npm run seed:demo
```

### 2. **Start Backend Server**
```bash
npm run dev
```

### 3. **Start Frontend** (in new terminal)
```bash
cd ../frontend
npm run dev
```

### 4. **Run Integration Tests** (showcase comprehensive testing)
```bash
cd backend
npm run test:presentation  # Full system integration tests
npm run test:security      # Security vulnerability testing
```

---

## 🔑 **Demo Credentials**

| Role | Email | Password |
|------|-------|----------|
| **Client** | client@demo.com | demo123 |
| **Staff** | staff@demo.com | demo123 |
| **Contractor** | contractor@demo.com | demo123 |
| **Landlord** | landlord@demo.com | demo123 |

---

## 🎬 **90-Second Demo Script**

### **Shot 1: Client Login & Dashboard (15s)**
1. Go to http://localhost:5173
2. Login as `client@demo.com` / `demo123`
3. Show user dashboard with existing tickets
4. Point out role-based authentication

### **Shot 2: Log New Ticket (20s)**
1. Click "Log a New Ticket"
2. Fill form: 
   - Title: "Demo: Bathroom light not working"
   - Description: "Light fixture completely dead"
   - Urgency: High
3. Submit and show success message
4. Return to dashboard to see new ticket

### **Shot 3: Staff Dashboard (20s)**
1. **New tab/incognito**: Login as `staff@demo.com` / `demo123`
2. Show staff can see ALL tickets (not just their own)
3. Show contractor management panel
4. Point out assignment capabilities

### **Shot 4: Landlord Approval Process (20s)**
1. **New tab**: Login as `landlord@demo.com` / `demo123`
2. Show pending approvals with costs
3. Click "Approve" on a quote
4. Show status change and cost tracking

### **Shot 5: System Features & Testing (15s)**
1. Show database viewer: http://localhost:5000/db-viewer
2. Run: `npm run test:presentation` (if time)
3. Show health endpoint: http://localhost:5000/api/health

---

## 📊 **Code Snippets for Slides**

### **1. Secure Authentication**
**File:** `backend/routes/auth.js` **Lines 53-63**
```javascript
const ok = await bcrypt.compare(password, user.PasswordHash);
if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

// Issue new session with audit trail
const { ip, userAgent } = getClientInfo(req);
const session = await issueSession({
  res,
  user: { userId: user.UserID, role: user.Role },
  userAgent,
  ip
});
```

### **2. Role-Based Data Access**
**File:** `backend/routes/tickets.js` **Lines 131-134**
```javascript
if (role === 'Client') {
  query += ' WHERE ClientUserID = ?';
  params.push(userId);
}
```

### **3. Input Validation & Security**
**File:** `backend/routes/auth.js` **Lines 95-99**
```javascript
if (!fullName || !email || !password || !role) {
  return res.status(400).json({ 
    message: 'Missing required fields: fullName, email, password, role' 
  });
}
```

---

## 🧪 **Testing Commands for Presentation**

### **Manual Integration Tests**
```bash
# Run comprehensive integration tests
npm run test:presentation

# Or run original tests
npm run test:integration
```

### **Health Check**
```bash
# Test server health
curl http://localhost:5000/api/health
```

### **Database Inspection**
Visit: http://localhost:5000/db-viewer

---

## 🔧 **Troubleshooting**

### **Server Won't Start**
```bash
# Check if ports are free
netstat -an | findstr :5000
netstat -an | findstr :5173

# Kill processes if needed
taskkill /F /IM node.exe
```

### **Database Issues**
```bash
# Re-run complete database setup
mysql -u root -p < database/sql/00-create-complete-database-with-sessions.sql

# Then re-seed
npm run seed:demo
```

### **Frontend Build Issues**
```bash
cd frontend
npm install
npm run build
npm run dev
```

---

## 📋 **Presentation Checklist**

- [ ] ✅ Demo data seeded (4 users, 3 tickets, 2 quotes)
- [ ] ✅ Backend running (http://localhost:5000)
- [ ] ✅ Frontend running (http://localhost:5173)
- [ ] ✅ Database connected and populated
- [ ] ✅ Integration tests passing
- [ ] ✅ All role logins working
- [ ] ✅ Code snippets ready in slides
- [ ] ✅ Screenshots captured for error cases

---

## 🎯 **Key Features to Highlight**

### **Security**
- ✅ bcrypt password hashing
- ✅ Dual-token authentication (JWT + refresh)
- ✅ Rate limiting
- ✅ Role-based access control
- ✅ Audit logging

### **Architecture**
- ✅ RESTful API design
- ✅ Modular route structure
- ✅ Comprehensive database schema (14 tables)
- ✅ File upload handling
- ✅ Error handling & validation

### **Functionality**
- ✅ Multi-role user system
- ✅ Ticket lifecycle management
- ✅ Quote approval workflow
- ✅ Session management
- ✅ Media attachment support

---

## 📱 **Demo URLs**

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Main application |
| Backend API | http://localhost:5000 | REST endpoints |
| Health Check | http://localhost:5000/api/health | System status |
| DB Viewer | http://localhost:5000/db-viewer | Database inspection |
| Session Demo | http://localhost:5000/demo | Token management demo |

---

## 🎪 **Final Tips**

1. **Practice the demo flow** - timing is crucial for 90 seconds
2. **Have backup plans** - screenshots if live demo fails
3. **Highlight security features** - this impresses assessors
4. **Show real code** - not just UI mockups
5. **Demonstrate testing** - shows professional development practices

**Good luck with your presentation! 🚀**
