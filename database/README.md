# Database Setup for Rawson Building Management System

This directory contains SQL scripts to set up the MySQL database for the Rawson project.

## Quick Setup

Run these scripts in order as MySQL root user:

```bash
mysql -u root -p < sql/01-create-database.sql
mysql -u root -p < sql/02-create-users-table.sql
mysql -u root -p < sql/03-create-app-user.sql
mysql -u root -p < sql/04-seed-admin.sql
```

## Scripts Overview

1. **01-create-database.sql** - Creates the `Rawson` database with UTF8MB4 charset
2. **02-create-users-table.sql** - Creates the `tblusers` table with indexes
3. **03-create-app-user.sql** - Creates limited-privilege user for the application
4. **04-seed-admin.sql** - Creates admin user for testing

## Important Security Notes

- **Change the password** in `03-create-app-user.sql` before running
- The admin user password is `Password123!` - **change this in production**
- Application user has minimal privileges (SELECT, INSERT, UPDATE only)

## Environment Configuration

After running the scripts, update your `backend/.env` file:

```env
DB_HOST=localhost
DB_USER=rawson_local
DB_PASSWORD=your_secure_password_here
DB_NAME=Rawson
DB_PORT=3306
```

## Verification

Test your setup by running the backend server and checking:
- http://localhost:5000/api/health - Should show database connected
- Login with: admin@rawson.local / Password123!
