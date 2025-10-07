# 🎥 Client Demo Script - Rawson Property Management System

## Demo Setup (Do Before Recording)
1. **Start servers**: `npm run dev:both` 
2. **Clear browser data**: Fresh start, no cached logins
3. **Close unnecessary apps**: Clean desktop for recording
4. **Test user accounts ready**:
   - Staff: `staff@demo.com` / `Password123!`
   - Client: `client@demo.com` / `Password123!`
   - Landlord: `landlord@demo.com` / `Password123!`
   - Contractor: `contractor@demo.com` / `Password123!`

---

## 🎬 Demo Flow (5-7 minutes total)

### **Scene 1: Login & Authentication (30 seconds)**
- Go to `http://localhost:5173`
- Show clean login page
- Login as **Staff**: `staff@demo.com` / `Password123!`
- Show successful login redirect to Staff Dashboard

### **Scene 2: Staff Dashboard - User Management (1 minute)**
- **Highlight**: Role Requests section (accept/reject functionality)
- Show staff can manage user registrations
- **Key point**: "This is where staff approve new users joining the system"
- Show other dashboard sections briefly (tickets, contractor management)

### **Scene 3: Ticket System - Client Flow (1.5 minutes)**
- Logout and login as **Client**: `client@demo.com` / `Password123!`
- **Create a new ticket**:
  - Property address: "123 Demo Street"
  - Issue: "Leaking faucet in kitchen"
  - Urgency: "High"
  - Upload a photo (any image file)
- Submit ticket
- Show ticket appears in client's ticket list
- **Key point**: "Clients can log maintenance issues with photos"

### **Scene 4: Multi-Role Dashboard Views (1 minute)**
- **Quick login switching** to show different dashboards:
  - **Landlord** (`landlord@demo.com`): Show landlord dashboard
  - **Contractor** (`contractor@demo.com`): Show contractor dashboard
- **Key point**: "Each role sees relevant information for their workflow"

### **Scene 5: Ticket Workflow Management (1.5 minutes)**
- Login back as **Staff** (`staff@demo.com`)
- Go to main tickets view
- Show the ticket created by client
- **Demonstrate**: "Assign Contractor" functionality
- Show ticket status progression
- **Key point**: "Staff coordinate the entire maintenance workflow"

### **Scene 6: System Health & Security (30 seconds)**
- Show `/api/health` endpoint (backend working)
- Brief glimpse of session management
- **Key point**: "System is secure with proper authentication"

### **Scene 7: Mobile Responsiveness (30 seconds)**
- Resize browser window to show mobile view
- Show responsive design works
- **Key point**: "System works on all devices"

---

## 🎯 Key Messages to Convey (Silent Demo)

### **Text Overlays to Add (Optional):**
1. "🔐 Secure Multi-Role Authentication"
2. "📋 Complete Ticket Management Workflow" 
3. "👥 Staff User Management & Approval System"
4. "📱 Mobile-Responsive Design"
5. "🏠 Role-Specific Dashboards (Client, Landlord, Contractor, Staff)"
6. "📸 File Upload & Media Management"

---

## 🛠 Demo Preparation Commands

```bash
# Start both servers
npm run dev:both

# Check all test users exist (optional)
mysql -u root -p -e "USE Rawson; SELECT UserID, FullName, Email, Role, Status FROM tblusers WHERE Email LIKE '%demo.com';"
```

---

## 📋 Demo Checklist

**Before Recording:**
- [ ] Servers running (Frontend + Backend)
- [ ] Browser cleared/fresh
- [ ] Test image file ready for upload
- [ ] All demo accounts working
- [ ] Desktop clean for recording

**During Demo:**
- [ ] Smooth transitions between roles
- [ ] Show key functionality, not every detail
- [ ] Keep mouse movements deliberate
- [ ] Pause briefly to let viewers see results

**Key Features to Highlight:**
- [ ] Multi-role authentication system
- [ ] Ticket creation with file uploads
- [ ] Staff workflow management
- [ ] Role-based dashboards
- [ ] Accept/reject user management
- [ ] Mobile responsiveness

---

## 🎥 Recording Tips

- **Screen Recording**: Use OBS, Loom, or Windows Game Bar
- **Resolution**: 1080p for clarity
- **Mouse**: Show cursor, make movements smooth
- **Timing**: 5-7 minutes max - clients have short attention spans
- **Focus**: Show working features, skip broken/incomplete ones