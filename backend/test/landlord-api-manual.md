# Landlord History API - Manual Testing Guide

## Overview

This document provides comprehensive manual testing instructions for the enhanced `GET /api/landlord/tickets` endpoint.

## API Endpoint Details

**URL:** `GET /api/landlord/tickets`  
**Authentication:** Required (Landlord role)  
**Content-Type:** `application/json`

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Number of results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `status` | string | - | Filter by ticket status |
| `dateFrom` | date | - | Filter tickets from date (YYYY-MM-DD) |
| `dateTo` | date | - | Filter tickets to date (YYYY-MM-DD) |

### Response Format

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "ticketId": 1,
        "referenceNumber": "TCKT-001",
        "description": "Leaky faucet in kitchen",
        "urgencyLevel": "High",
        "status": "Quoting",
        "createdAt": "2023-01-15T10:30:00.000Z",
        "client": {
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "+1234567890"
        },
        "quote": {
          "id": 10,
          "amount": 150.00,
          "status": "Approved",
          "submittedAt": "2023-01-16T14:15:00.000Z",
          "contractor": {
            "name": "Mike Smith",
            "email": "mike@contractor.com"
          },
          "landlordApproval": {
            "status": "Approved",
            "approvedAt": "2023-01-17T09:45:00.000Z"
          }
        },
        "nextAppointment": {
          "id": 5,
          "scheduledDate": "2023-01-20T10:00:00.000Z",
          "clientConfirmed": true
        }
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

## Prerequisites for Testing

### 1. Server Setup

Ensure the backend server is running:

```bash
cd backend
npm install
npm run dev
```

Server should be available at `http://localhost:5000`

### 2. Database Setup

Ensure you have test data in your database:

```sql
-- Create test landlord
INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status)
VALUES ('Test Landlord', 'landlord@test.com', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', 'Landlord', 'Active');

-- Create test client
INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status)
VALUES ('Test Client', 'client@test.com', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', 'Client', 'Active');

-- Create test contractor
INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status)
VALUES ('Test Contractor', 'contractor@test.com', '$2b$12$GwD4ledPuqrDI3CVijXScurralqh1VedX/I9alVhrno16xk5rLGWq', 'Contractor', 'Active');
```

### 3. Get Authentication Token

First, authenticate to get session cookies:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "landlord@test.com",
    "password": "Password123!"
  }' \
  -c cookies.txt \
  -v
```

This will save authentication cookies to `cookies.txt` for subsequent requests.

## Test Scenarios

### Test 1: Basic Authenticated Request

**Purpose:** Verify basic functionality for authenticated landlord

```bash
curl -X GET "http://localhost:5000/api/landlord/tickets" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v
```

**Expected Result:**
- Status: 200 OK
- Response contains tickets array
- Response includes pagination info
- Each ticket has properly formatted client, quote, and appointment data

### Test 2: Pagination Parameters

**Purpose:** Test pagination controls

```bash
curl -X GET "http://localhost:5000/api/landlord/tickets?limit=10&offset=0" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v
```

**Expected Result:**
- Status: 200 OK
- Response contains max 10 tickets
- Pagination object shows correct limit and offset

### Test 3: Status Filtering

**Purpose:** Test status-based filtering

```bash
curl -X GET "http://localhost:5000/api/landlord/tickets?status=Completed" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v
```

**Expected Result:**
- Status: 200 OK
- Only tickets with "Completed" status returned

### Test 4: Date Range Filtering

**Purpose:** Test date range filtering

```bash
curl -X GET "http://localhost:5000/api/landlord/tickets?dateFrom=2023-01-01&dateTo=2023-12-31" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v
```

**Expected Result:**
- Status: 200 OK
- Only tickets created within date range returned

### Test 5: Parameter Validation

**Purpose:** Test parameter boundary validation

```bash
# Test limit validation (should cap at 100)
curl -X GET "http://localhost:5000/api/landlord/tickets?limit=1000" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v

# Test negative offset (should default to 0)
curl -X GET "http://localhost:5000/api/landlord/tickets?offset=-10" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v
```

**Expected Result:**
- Status: 200 OK
- Limits are enforced correctly
- No more than 100 results returned
- Offset cannot be negative

### Test 6: Unauthenticated Request

**Purpose:** Verify authentication requirement

```bash
curl -X GET "http://localhost:5000/api/landlord/tickets" \
  -H "Accept: application/json" \
  -v
```

**Expected Result:**
- Status: 401 Unauthorized
- Error message: "Not authenticated"

### Test 7: Wrong Role Authentication

**Purpose:** Test role-based access control

```bash
# First login as a client
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "Password123!"
  }' \
  -c client-cookies.txt \
  -v

# Then try to access landlord endpoint
curl -X GET "http://localhost:5000/api/landlord/tickets" \
  -H "Accept: application/json" \
  -b client-cookies.txt \
  -v
```

**Expected Result:**
- Status: 403 Forbidden
- Error message: "Insufficient privileges"

### Test 8: Empty Results

**Purpose:** Test handling of no tickets found

```bash
# If landlord has no tickets, or use very restrictive filters
curl -X GET "http://localhost:5000/api/landlord/tickets?status=NonExistentStatus" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -v
```

**Expected Result:**
- Status: 200 OK
- Empty tickets array: `"tickets": []`
- Pagination total: 0

## Postman Collection

If you prefer using Postman, here's a collection you can import:

```json
{
  "info": {
    "name": "Landlord History API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Login as Landlord",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"landlord@test.com\",\n  \"password\": \"Password123!\"\n}"
        },
        "url": {
          "raw": "http://localhost:5000/api/auth/login",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "auth", "login"]
        }
      }
    },
    {
      "name": "Get Landlord Tickets",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Accept",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/landlord/tickets",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "landlord", "tickets"]
        }
      }
    },
    {
      "name": "Get Landlord Tickets with Pagination",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Accept",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/landlord/tickets?limit=10&offset=0",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "landlord", "tickets"],
          "query": [
            {"key": "limit", "value": "10"},
            {"key": "offset", "value": "0"}
          ]
        }
      }
    },
    {
      "name": "Get Tickets by Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Accept",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/landlord/tickets?status=Completed",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "landlord", "tickets"],
          "query": [
            {"key": "status", "value": "Completed"}
          ]
        }
      }
    }
  ]
}
```

## Common Issues and Troubleshooting

### Issue: 404 Not Found

**Possible Causes:**
- Server not running
- Incorrect URL path
- Router not properly mounted

**Solution:**
- Verify server is running on correct port
- Check that landlord routes are mounted in `server.js`

### Issue: 500 Internal Server Error

**Possible Causes:**
- Database connection issues
- SQL query errors
- Missing database tables

**Solution:**
- Check server logs for specific error
- Verify database connection
- Run database migration scripts

### Issue: Empty Results Despite Having Data

**Possible Causes:**
- Database schema mismatch
- Landlord not associated with any tickets
- Incorrect JOIN logic in SQL

**Solution:**
- Verify test data setup
- Check that `tblLandlordApprovals` table has entries linking landlord to quotes
- Run SQL queries manually to verify data relationships

### Issue: Authentication Failures

**Possible Causes:**
- Expired session cookies
- Incorrect role in JWT token
- Middleware not properly configured

**Solution:**
- Re-authenticate to get fresh cookies
- Verify user role in database
- Check middleware import paths

## Performance Considerations

- **Large datasets:** Use appropriate `limit` values to avoid timeouts
- **Complex queries:** Monitor query execution time for large tables
- **Indexes:** Ensure proper database indexes on commonly filtered columns

## Security Notes

- All authentication is handled via HTTP-only cookies
- Role-based access control prevents cross-role data access
- Sensitive error details are only shown in development mode
- SQL injection is prevented through parameterized queries

## Next Steps

After successful manual testing:

1. Run automated test suite: `npm test landlord-api.test.js`
2. Load test with larger datasets
3. Verify performance with realistic data volumes
4. Test with concurrent requests
5. Update frontend to consume the new API format
