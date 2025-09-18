# Database Structure Documentation

## 📁 Professional Database Organization

### Folder Structure
```
database/
├── migrations/           # Database schema changes (versioned)
├── seeds/               # Test data and initial data seeding
├── utilities/           # Helper scripts and tools
├── backups/            # Database backup files
├── documentation/      # Database documentation
├── temp/               # Temporary files (gitignored)
└── sql/                # Legacy scripts (being reorganized)
```

## 🎯 Production Database Schema

### Current Tables (16 total):
- `tblusers` - Core user management
- `tbltickets` - Service tickets
- `tblquotes` - Contractor quotes  
- `tbllandlordapprovals` - Landlord quote approvals
- `tblcontractorschedules` - Appointment scheduling
- `tblcontractorupdates` - Work progress updates
- `tblticketmedia` - File attachments
- `tblquotedocuments` - Quote attachments
- `tblcommunications` - Message threads
- `tblnotifications` - System notifications
- `tblticketstatushistory` - Audit trail
- `tblauditlogs` - System audit logs
- `tblrefreshtokens` - JWT refresh tokens
- `tblrevokedaccessjti` - Security tokens
- `tblpasswordresets` - Password reset tokens  
- `tblpasswordresettokens` - Legacy password resets

## 👥 User Roles & Test Accounts

### Available Roles:
- **Client** - Property tenants/residents
- **Landlord** - Property owners  
- **Contractor** - Service providers
- **Staff** - Rawson employees/admins

### Test Credentials (All use: Password123!):
- **Staff**: admin@rawson.local
- **Landlord**: landlord@demo.com, landlord@test.com
- **Client**: client@demo.com, client@test.com  
- **Contractor**: contractor@demo.com, contractor@test.com

## 🔄 Migration Strategy

### Current State: MySQL Local
### Target State: Firebase + AWS RDS

#### Phase 1: Organization (Current)
- Restructure existing SQL files
- Create master setup/reset scripts
- Document all relationships

#### Phase 2: Cloud Migration  
- Firebase Authentication integration
- AWS RDS setup
- Data migration scripts

## 🛡️ Security Considerations

- All passwords are bcrypt hashed (12 rounds)
- JWT token system with refresh tokens
- Role-based access control
- Comprehensive audit logging
- Password reset functionality

## 🚀 Quick Setup Commands

```bash
# Full database setup
mysql -u root -p < migrations/00-master-setup.sql

# Reset to clean state  
mysql -u root -p < utilities/reset-database.sql

# Load test data
mysql -u root -p < seeds/test-users.sql
```

---
*Professional Database Structure for Red Rabbit Replacement - Rawson Client*