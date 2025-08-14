# Database Setup for Rawson Building Management System

This directory contains SQL scripts to set up the complete MySQL database schema for the Rawson building maintenance management system.

## 🚀 Ultimate One-Command Setup

**🎯 EASIEST WAY: Create the entire system with ONE command!**

```bash
# Creates EVERYTHING: database + all tables + admin user + indexes
mysql -u root -p < database/sql/00-create-complete-database.sql
```

**That's it!** ✨ The entire Rawson database system will be created automatically.

---

## 🔧 Alternative Setup Methods

### Option 2: Step-by-step (Basic + Tickets)
```bash
# Basic setup first
mysql -u root -p < sql/01-create-database.sql
mysql -u root -p < sql/02-create-users-table.sql
mysql -u root -p < sql/03-create-app-user.sql
mysql -u root -p < sql/04-seed-admin.sql

# Then all ticket management tables at once
mysql -u root -p < sql/15-create-all-ticket-tables.sql
```

### Option 3: Individual table scripts (for learning/debugging)
```bash
# Individual table creation (if you prefer step-by-step)
mysql -u root -p < sql/05-create-tickets-table.sql
mysql -u root -p < sql/06-create-ticket-media-table.sql
mysql -u root -p < sql/07-create-ticket-status-history-table.sql
mysql -u root -p < sql/08-create-quotes-table.sql
mysql -u root -p < sql/09-create-quote-documents-table.sql
mysql -u root -p < sql/10-create-landlord-approvals-table.sql
mysql -u root -p < sql/11-create-contractor-schedules-table.sql
mysql -u root -p < sql/12-create-contractor-updates-table.sql
mysql -u root -p < sql/13-create-notifications-table.sql
mysql -u root -p < sql/14-create-communications-table.sql
```

## 📋 Database Schema Overview

### Core Tables
1. **tblusers** - User management (Clients, Landlords, Contractors, Staff)
2. **tblTickets** - Maintenance tickets submitted by clients
3. **tblTicketMedia** - Image/video attachments for tickets
4. **tblTicketStatusHistory** - Audit trail of status changes

### Quote Management
5. **tblQuotes** - Contractor quotes for maintenance work
6. **tblQuoteDocuments** - PDF/image attachments for quotes
7. **tblLandlordApprovals** - Landlord approval/rejection decisions

### Job Execution
8. **tblContractorSchedules** - Appointment scheduling
9. **tblContractorUpdates** - Progress updates during work

### Communication
10. **tblNotifications** - System notifications (Push, Email, WhatsApp)
11. **tblCommunications** - Message history between users

## 🔗 Entity Relationships

### Key Relationships
- **Users → Tickets** (1:Many) - Clients create tickets
- **Tickets → Media** (1:Many) - Tickets can have multiple attachments
- **Tickets → Quotes** (1:Many) - Multiple contractors can quote
- **Quotes → Approvals** (1:1) - Each quote gets one approval decision
- **Users ↔ Communications** (Many:Many) - Users send/receive messages

### Foreign Key Constraints
- **ON DELETE CASCADE** - Child records deleted when parent is deleted
- **ON DELETE RESTRICT** - Prevents deletion if child records exist
- **ON UPDATE CASCADE** - Updates propagated to child records

## 📊 Performance Features

### Indexes Created
- **Primary Keys** - Auto-generated unique identifiers
- **Foreign Key Indexes** - Fast joins between related tables
- **Status Indexes** - Quick filtering by ticket/quote status
- **Date Indexes** - Efficient date range queries
- **User Indexes** - Fast user-specific data retrieval

### Database Engine
- **InnoDB** - ACID compliance, foreign keys, row-level locking
- **UTF8MB4** - Full Unicode support including emojis
- **Collation** - Case-insensitive sorting (utf8mb4_0900_ai_ci)

## 🔧 Scripts Overview

| Script | Description | Dependencies |
|--------|-------------|-------------|
| 01-create-database.sql | Creates Rawson database | None |
| 02-create-users-table.sql | User management table | Database |
| 03-create-app-user.sql | Limited-privilege app user | Database |
| 04-seed-admin.sql | Admin test user | Users table |
| 05-create-tickets-table.sql | Main tickets table | Users table |
| 06-create-ticket-media-table.sql | Ticket attachments | Tickets table |
| 07-create-ticket-status-history-table.sql | Status audit trail | Tickets, Users |
| 08-create-quotes-table.sql | Contractor quotes | Tickets, Users |
| 09-create-quote-documents-table.sql | Quote attachments | Quotes table |
| 10-create-landlord-approvals-table.sql | Quote approvals | Quotes, Users |
| 11-create-contractor-schedules-table.sql | Appointment scheduling | Tickets, Users |
| 12-create-contractor-updates-table.sql | Job progress updates | Tickets, Users |
| 13-create-notifications-table.sql | System notifications | Users, Tickets |
| 14-create-communications-table.sql | Message history | Users, Tickets |
| **15-create-all-ticket-tables.sql** | **Master script (All tables)** | Users table |

## ⚠️ Important Security Notes

- **Change passwords** in `03-create-app-user.sql` before running
- **Admin password** is `Password123!` - **change this in production**
- **Application user** has minimal privileges (SELECT, INSERT, UPDATE only)
- **Foreign keys** prevent data integrity issues
- **Transactions** ensure atomic operations

## 🔧 Environment Configuration

After running the scripts, update your `backend/.env` file:

```env
DB_HOST=localhost
DB_USER=rawson_local
DB_PASSWORD=your_secure_password_here
DB_NAME=Rawson
DB_PORT=3306
```

## ✅ Verification

Test your setup:
1. **Backend Health**: http://localhost:5000/api/health - Should show database connected
2. **Admin Login**: admin@rawson.local / Password123!
3. **Table Count**: Run verification queries in master script

## 🎯 Usage Examples

### Create a Test Ticket
```sql
INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel) 
VALUES (1, 'TIK-2024-001', 'Leaky faucet in kitchen', 'Medium');
```

### Add Quote for Ticket
```sql
INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteDescription) 
VALUES (1, 2, 150.00, 'Replace faucet washer and seals');
```

### Track Status Changes
```sql
INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID) 
VALUES (1, 'In Review', 1);
```
