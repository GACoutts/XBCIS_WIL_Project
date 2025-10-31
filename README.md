# 🏢 GoodLiving - Building Management System

**Rawson Building Management System**

Our XBCIS Work Integrated Learning project involved developing a comprehensive building management system for Rawson Property Management. GoodLiving streamlines maintenance workflows, quote approvals, and contractor scheduling for multi-property residential management.

## 👥 Team Members

This project was developed by:
- **Teejay Kamwaro**
- **Keanu Muller**
- **Benre Nel**
- **Pierre-Anri Potgieter**
- **Charl Volschenk**
- **Grant Coutts**

## 🚀 Quick Start - Running Both Frontend & Backend

**Single Command Setup:** Run both the React frontend and Express backend simultaneously with one command!

```bash
npm run dev:both
```

**Bypass Powershell:** This will bypass the restriction that powershell poses

```bash
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### ✅ Prerequisites

Before running the project, ensure you have:

- **Node.js** v18+ (we recommend v22+)
- **npm** v9+ (we recommend v10+)
- **MySQL** database running (see Database Setup section)
- **Git** for version control

Check your versions:
```bash
node -v    # Should show v18.0.0 or higher
npm -v     # Should show v9.0.0 or higher
```

### 📦 Installation Steps

1. **Clone the repository** (if not already done):
   ```bash
   git clone [repository-url]
   cd XBCIS_WIL_Project
   ```

2. **Switch to the main branch**:
   ```bash
   git checkout main
   ```

3. **Install root dependencies** (includes frontend tools):
   ```bash
   npm install
   ```

4. **Install backend dependencies**:
   ```bash
   npm install --prefix backend
   ```

5. **Set up environment variables** (see Database Setup below)

6. **Start both servers** with the magic command:
   ```bash
   npm run dev:both
   ```

### 🎯 What Happens When You Run `npm run dev:both`

This command uses `concurrently` to run both servers simultaneously:

- **Frontend (FE)**: React + Vite development server
  - 🌐 Accessible at: http://localhost:5173
  - 🔄 Hot reload enabled for instant development feedback
  - 🔗 Automatically proxies API calls to backend

- **Backend (BE)**: Express.js API server
  - 🌐 Accessible at: http://localhost:5000
  - 🔍 Health check: http://localhost:5000/api/health
  - 🗄️ Database integration with connection pooling

You'll see colored output like this:
```
[FE] VITE v7.1.2  ready in 258 ms
[FE] ➜  Local:   http://localhost:5173/
[BE] Backend running on :) http://localhost:5000
[BE] ✓ Database connection established successfully
```

### 🛠️ Individual Commands (Alternative)

If you need to run servers separately:

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Both together (same as dev:both)
npm run dev:both
```

### 🗄️ Database Setup

1. **Run the master setup script** (recommended for new installations):
   ```bash
   mysql -u root -p < database/sql/00-master-setup.sql
   ```
   This creates all necessary tables, indexes, and constraints.

   **Alternative:** For a complete fresh start:
   ```bash
   mysql -u root -p < database/sql/00-reset-complete-database.sql
   ```

2. **Create environment file** in the backend directory:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. **Configure your database connection** in `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=Rawson
   DB_PORT=3306
   ```

4. **Test database connection**:
   - Visit: http://localhost:5000/api/health
   - Should return: `{"status":"healthy","database":"connected"}`

📖 **For detailed database setup instructions**, see [database/README.md](database/README.md)

### 🔑 Test Staff Account

The master setup script automatically creates a staff account for testing and evaluation:

**Staff Login Credentials:**
- **Email**: `admin@wil.com`
- **Password**: `Password123!`

This account has full administrative privileges and can approve/reject role requests, manage users, and access all staff functions.

### 🔧 Troubleshooting

#### Port Already in Use
```bash
# Kill processes on ports 5173 and 5000
npx kill-port 5173 5000
```

#### concurrently Command Not Found
```bash
# Reinstall dependencies
npm install
# Or install concurrently specifically
npm install -D concurrently
```

#### Backend Database Errors
1. Ensure MySQL is running
2. Check `backend/.env` configuration
3. Verify database exists and user has permissions
4. Test with: http://localhost:5000/api/health

#### Frontend Not Loading
1. Check if Vite started successfully (should show Local URL)
2. Ensure port 5173 is available
3. Try refreshing the browser
4. Check browser console for errors

### 📁 Project Structure

```
XBCIS_WIL_Project/
├── backend/              # Express.js API server
│   ├── server.js        # Main server file
│   ├── db.js            # Database connection
│   ├── routes/          # API route handlers
│   ├── middleware/      # Auth, rate limiting, RBAC
│   ├── utils/           # Tokens, notifications, helpers
│   ├── docs/            # Backend documentation
│   ├── package.json     # Backend dependencies
│   └── .env.example     # Environment template
├── frontend/            # React + Vite app
│   ├── src/            # React components & pages
│   │   ├── components/ # Reusable UI components
│   │   ├── styles/     # CSS styling
│   │   └── *.jsx       # Dashboard pages (User, Staff, Landlord, Contractor)
│   ├── package.json    # Frontend dependencies
│   └── vite.config.js  # Vite configuration
├── database/            # SQL scripts & documentation
│   ├── sql/            # Database setup scripts
│   ├── documentation/  # Database schema docs
│   └── README.md       # Database setup guide
├── docs/                # Project documentation
├── package.json         # Root package with dev:both script
├── SECURITY.md          # Security features & guidelines
└── README.md            # This file
```

### 🧪 Testing the Setup

After running `npm run dev:both`, verify everything works:

1. **Frontend**: Open http://localhost:5173 - should load the React app
2. **Backend Direct**: Open http://localhost:5000 - should show API documentation
3. **Health Check**: Open http://localhost:5000/api/health - should return JSON status
4. **Proxy Test**: Open http://localhost:5173/api/health - should return same JSON (via Vite proxy)

### 🔐 Security Features

GoodLiving implements enterprise-grade security:

- **Authentication**: Dual-token JWT system (access + refresh tokens)
- **Authorization**: Role-based access control (RBAC) for Client, Landlord, Contractor, Staff
- **Rate Limiting**: Protects against brute force and API abuse
- **Session Management**: Multi-device session tracking with selective logout
- **Cookie Security**: HttpOnly, Secure, SameSite=Strict flags
- **Account Status Enforcement**: Suspended/inactive users blocked at all levels
- **Audit Logging**: Comprehensive tracking of sensitive operations

📖 **For complete security details**, see [SECURITY.md](SECURITY.md)

### ☁️ AWS Deployment

**Status**: 🚧 In Progress

AWS deployment documentation will be added once implementation is complete. This section will include:
- AWS infrastructure setup
- Deployment procedures
- Environment configuration
- Scaling guidelines

*Currently being implemented by Grant Coutts.*

### 👥 Team Development

- **Branch**: Work on `main` branch for stable development
- **Pulling Updates**: Run `npm install` and `npm install --prefix backend` after pulling
- **Environment**: Never commit `.env` files - use `.env.example` templates
- **Dependencies**: Add frontend deps to root `package.json`, backend deps to `backend/package.json`

### 🏗️ Production Build

```bash
# Build frontend for production
npm run build

# Preview production build
npm run preview
```

---

## 📞 Need Help?

If you encounter issues:
1. Check this README's troubleshooting section
2. Verify prerequisites are installed correctly
3. Ensure you're on the `main` branch
4. Consult our documentation resources:
   - 🗄️ [Database Setup Guide](database/README.md) - Complete database installation & schema
   - 🔐 [Security Documentation](SECURITY.md) - Security features & testing checklist
   - 📡 [API Documentation](backend/API_DOCUMENTATION.md) - Landlord API endpoints
   - 🔑 [Session Management](backend/docs/SESSION_MANAGEMENT.md) - Auth system details
   - 📊 [Database Structure](database/documentation/DATABASE_STRUCTURE.md) - Schema & relationships
5. Ask the team on our communication channel

**Built with care for better living. 🏡**
