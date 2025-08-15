# Rawson Database Setup Guide

## Overview
This guide covers the complete setup of MySQL database for the Rawson Building Management System. The database stores user authentication data and will be extended for property management features.

## Prerequisites
- Node.js (v16 or higher)
- npm (Node Package Manager)
- MySQL Server 8.0+ installed and running
- MySQL Workbench (optional, for GUI management)

## Database Architecture
- **Database Name**: `Rawson`
- **Main Table**: `tblusers` - stores user authentication and profile data
- **Character Set**: UTF-8 (utf8mb4)
- **Authentication**: bcrypt password hashing with 12 rounds

## Quick Setup (For New Team Members)

### 1. Database Creation
Run the SQL scripts in the `XBCIS_WIL_PROJECT/database/sql/` directory in this order:

1. **01-create-database.sql** - Creates the Rawson database
2. **02-create-users-table.sql** - Creates the tblusers table with proper schema
3. **03-create-app-user.sql** - Creates the application user with limited privileges
4. **04-seed-admin.sql** - Seeds an admin user for testing

### 2. Backend Environment Setup
1. Copy `XBCIS_WIL_PROJECT/backend/.env.example` to `XBCIS_WIL_PROJECT/backend/.env`
2. Update the `.env` file with your database password:
   ```bash
   DB_PASSWORD=your_actual_password_here
   ```

### 3. Install Dependencies and Test
```bash
cd XBCIS_WIL_PROJECT/backend
npm install
node server.js
```

## Detailed Setup Instructions

### MySQL Installation (Windows)
1. Download MySQL Installer from https://dev.mysql.com/downloads/installer/
2. Choose "Developer Default" setup type
3. Configure MySQL Server:
   - **Config Type**: Development Computer
   - **Connectivity**: TCP/IP, Port 3306
   - **Authentication**: Use Strong Password Encryption
   - **Root Password**: Choose a strong password and store securely
   - **Windows Service**: MySQL80, Start at system boot
4. Complete installation and start the service

### Security Hardening
Our setup implements several security best practices:
- **Local-only access**: MySQL binds to 127.0.0.1 (localhost only)
- **Least privilege user**: `rawson_local` user has only SELECT, INSERT, UPDATE permissions
- **No remote root access**: Root user restricted to localhost connections
- **Password hashing**: bcrypt with 12 rounds for all user passwords
- **Input sanitization**: Parameterized queries prevent SQL injection

### Database Schema

#### tblusers Table Structure
```sql
CREATE TABLE tblusers (
  UserID INT AUTO_INCREMENT PRIMARY KEY,
  FullName VARCHAR(100) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  Phone VARCHAR(20) NULL,
  Role ENUM('Client','Landlord','Contractor','Staff') NOT NULL,
  DateRegistered DATETIME DEFAULT CURRENT_TIMESTAMP,
  Status ENUM('Active','Inactive','Suspended') DEFAULT 'Active'
);
```

**Indexes**:
- Primary key on `UserID`
- Unique index on `Email`
- Index on `Status` for fast filtering
- Index on `Role` for role-based queries

## Backend Integration

### Environment Variables
Create a `.env` file in the backend directory:
```bash
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=rawson_local
DB_PASSWORD=your_strong_password
DB_NAME=Rawson

# Security Configuration
BCRYPT_ROUNDS=12

# Server Configuration
PORT=5000
```

### API Endpoints

#### POST /api/register
Register a new user account.
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "phone": "0210000000",
  "role": "Client"
}
```

**Response (201):**
```json
{
  "userId": 1,
  "email": "john@example.com",
  "fullName": "John Doe",
  "role": "Client",
  "message": "User registered successfully"
}
```

#### POST /api/login
Authenticate user login.
```json
{
  "email": "admin@rawson.local",
  "password": "Password123!"
}
```

**Response (200):**
```json
{
  "userId": 1,
  "username": "admin@rawson.local",
  "fullName": "Admin User",
  "email": "admin@rawson.local",
  "role": "Staff"
}
```

#### GET /api/health
Check database connectivity.
**Response (200):**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

## Frontend Integration

### Vite Proxy Setup
Add to your `vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
```

### Testing the Integration
1. Start the backend: `npm run dev` from `XBCIS_WIL_PROJECT/backend/`
2. Start the frontend: `npm run dev` from project root
3. Test login with seeded user:
   - Email: `admin@rawson.local`
   - Password: `Password123!`

## Testing and Validation

### Manual API Testing
Use curl or Postman to test endpoints:

**Health Check:**
```bash
curl http://localhost:5000/api/health
```

**Login Test:**
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rawson.local","password":"Password123!"}'
```

**Registration Test:**
```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@rawson.local",
    "password": "Password123!",
    "phone": "0210000000",
    "role": "Client"
  }'
```

## Data Management

### Database Backup
```bash
# Create backup
mysqldump -u root -p --single-transaction --routines --triggers Rawson > rawson_backup.sql

# Restore from backup
mysql -u root -p Rawson < rawson_backup.sql
```

### Reset Database
```sql
-- Remove all users but keep structure
DELETE FROM tblusers;

-- Reset auto-increment
ALTER TABLE tblusers AUTO_INCREMENT = 1;

-- Re-run seed script
SOURCE XBCIS_WIL_PROJECT/database/sql/04-seed-admin.sql;
```

## Development Workflow

### Branch Management
- All database changes should be made on the `database` branch
- Test thoroughly before merging to `main`
- Document any schema changes in this README

### Git Workflow
```bash
# Switch to database branch
git checkout database

# Pull latest changes
git pull origin database

# Make changes, commit with descriptive messages
git add .
git commit -m "db: add new table for property management"

# Push changes
git push origin database

# Create pull request for review
```

### Migration Strategy
For future schema changes:
1. Create migration scripts in `database/migrations/`
2. Test on development data
3. Document changes in this README
4. Coordinate with team for production deployment

## Troubleshooting

### Common Issues and Solutions

**MySQL Service Not Starting**
```bash
# Check service status
Get-Service -Name "MySQL*"

# Start service
Start-Service -Name "MySQL80"

# Or via Services.msc GUI
```

**Port 3306 Already in Use**
```bash
# Find what's using port 3306
netstat -ano | findstr 3306

# Kill the process or change MySQL port in my.ini
```

**ER_ACCESS_DENIED_ERROR**
- Verify username and password in `.env` file
- Ensure `rawson_local` user exists and has correct privileges
- Check that user is created for `localhost` not `%`

**ER_NOT_SUPPORTED_AUTH_MODE**
```sql
-- Update authentication method
ALTER USER 'rawson_local'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'your_password';
```

**Cannot Connect to Database from Backend**
1. Verify MySQL service is running
2. Check `.env` file has correct credentials
3. Test connection with MySQL command line:
   ```bash
   mysql -u rawson_local -p -h 127.0.0.1 Rawson
   ```

**Workbench Connection Issues**
- Use `127.0.0.1` instead of `localhost`
- Verify port 3306 is correct
- Check Windows Firewall settings
- Try connecting via command line first

**Email Already Exists Error**
- This is expected behavior for duplicate registrations
- Use different email or update existing user
- Check for case-sensitivity issues

### Performance Issues

**Slow Queries**
- Verify indexes exist on `Email`, `Status`, and `Role` columns
- Use `EXPLAIN` to analyze query performance
- Consider connection pooling (already implemented)

**Connection Pool Exhaustion**
- Current limit: 10 connections
- Increase `connectionLimit` in `db.js` if needed
- Check for connection leaks in application code

## Security Considerations

### Password Security
- Minimum 8 characters recommended
- bcrypt with 12 rounds (adjust `BCRYPT_ROUNDS` if needed)
- Never store plain text passwords
- Consider password complexity requirements

### SQL Injection Prevention
- All queries use parameterized statements
- Never concatenate user input into SQL strings
- Validate input on both frontend and backend

### Network Security
- Database bound to localhost only
- No remote access to MySQL server
- Use HTTPS in production (not implemented yet)

### Access Control
- Application user has minimal required privileges
- No DROP, ALTER, or DELETE permissions initially
- Elevate permissions only when needed for migrations

## Future Enhancements

### Planned Features
1. **Session Management**: JWT tokens for authentication
2. **Password Reset**: Email-based password recovery
3. **User Profiles**: Extended user information storage
4. **Property Tables**: Buildings, units, lease management
5. **Audit Logging**: Track all database changes
6. **Data Encryption**: Encrypt sensitive fields at rest

### Migration Planning
- Use structured migration files
- Version control all schema changes
- Test migrations on development data first
- Plan rollback strategies

## Team Collaboration

### Documentation Updates
- Update this README when making database changes
- Include examples for new API endpoints
- Document any new environment variables

### Code Review Checklist
- [ ] SQL queries use parameterized statements
- [ ] New tables have appropriate indexes
- [ ] Migration scripts are tested
- [ ] Environment variables documented
- [ ] API responses don't include sensitive data
- [ ] Error handling covers database failures

### Testing Guidelines
- Test all API endpoints after database changes
- Verify frontend integration still works
- Test with various user roles and statuses
- Confirm backup and restore procedures work

---

## Quick Reference

**Default Admin User (for testing only):**
- Email: `admin@rawson.local`
- Password: `Password123!`
- Role: `Staff`

**Database Connection:**
- Host: `127.0.0.1`
- Port: `3306`
- Database: `Rawson`
- User: `rawson_local`

**Key Files:**
- Database scripts: `XBCIS_WIL_PROJECT/database/sql/`
- Backend config: `XBCIS_WIL_PROJECT/backend/.env`
- Connection pool: `XBCIS_WIL_PROJECT/backend/db.js`
- Server routes: `XBCIS_WIL_PROJECT/backend/server.js`

For additional help, check the troubleshooting section or contact the development team.
