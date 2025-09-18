// backend/test/landlord-api.test.js - Comprehensive test suite for landlord API
import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import landlordRouter from '../routes/landlord.js';
import pool from '../db.js';
import { issueSession } from '../utils/tokens.js';

// Mock dependencies
jest.mock('../db.js');
jest.mock('../utils/tokens.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/landlord', landlordRouter);

describe('Landlord Tickets API', () => {
  let mockDbQuery;
  let mockIssueSession;

  beforeEach(() => {
    mockDbQuery = jest.mocked(pool.execute);
    mockIssueSession = jest.mocked(issueSession);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/landlord/tickets', () => {
    const mockLandlordUserId = 5;
    const mockAccessToken = 'mock-jwt-token';

    // Mock auth middleware by setting up a test user
    const authenticatedRequest = () =>
      request(app)
        .get('/api/landlord/tickets')
        .set('Cookie', [`access_token=${mockAccessToken}`]);

    beforeEach(() => {
      // Mock successful token verification (simulating middleware)
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue({
        sub: mockLandlordUserId,
        role: 'Landlord',
        jti: 'mock-jti'
      });
    });

    test('should return tickets for authenticated landlord with comprehensive data', async () => {
      const mockTickets = [
        {
          TicketID: 1,
          TicketRefNumber: 'TCKT-001',
          Description: 'Leaky faucet in kitchen',
          UrgencyLevel: 'High',
          CreatedAt: new Date('2023-01-15'),
          CurrentStatus: 'Quoting',
          ClientName: 'John Doe',
          ClientEmail: 'john@example.com',
          ClientPhone: '+1234567890',
          QuoteID: 10,
          QuoteAmount: 150.00,
          QuoteStatus: 'Approved',
          QuoteSubmittedAt: new Date('2023-01-16'),
          ContractorName: 'Mike Smith',
          ContractorEmail: 'mike@contractor.com',
          ScheduleID: 5,
          AppointmentDate: new Date('2023-01-20T10:00:00'),
          AppointmentConfirmed: true,
          LandlordApprovalStatus: 'Approved',
          LandlordApprovedAt: new Date('2023-01-17')
        }
      ];

      const mockCountResult = [{ total: 1 }];

      mockDbQuery
        .mockResolvedValueOnce([mockTickets]) // Main query
        .mockResolvedValueOnce([mockCountResult]); // Count query

      const response = await authenticatedRequest();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tickets).toHaveLength(1);
      
      const ticket = response.body.data.tickets[0];
      expect(ticket).toMatchObject({
        ticketId: 1,
        referenceNumber: 'TCKT-001',
        description: 'Leaky faucet in kitchen',
        urgencyLevel: 'High',
        status: 'Quoting',
        client: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890'
        },
        quote: {
          id: 10,
          amount: 150.00,
          status: 'Approved',
          contractor: {
            name: 'Mike Smith',
            email: 'mike@contractor.com'
          },
          landlordApproval: {
            status: 'Approved'
          }
        },
        nextAppointment: {
          id: 5,
          clientConfirmed: true
        }
      });

      expect(response.body.data.pagination).toMatchObject({
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false
      });
    });

    test('should return empty array for landlord with no tickets', async () => {
      mockDbQuery
        .mockResolvedValueOnce([[]]) // Empty tickets
        .mockResolvedValueOnce([[{ total: 0 }]]); // Zero count

      const response = await authenticatedRequest();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tickets).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should handle query parameters correctly', async () => {
      mockDbQuery
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]]);

      await request(app)
        .get('/api/landlord/tickets')
        .query({
          limit: 10,
          offset: 20,
          status: 'Completed',
          dateFrom: '2023-01-01',
          dateTo: '2023-12-31'
        })
        .set('Cookie', [`access_token=${mockAccessToken}`]);

      // Verify the query was called with correct parameters
      const [query, params] = mockDbQuery.mock.calls[0];
      expect(query).toContain('t.CurrentStatus = ?');
      expect(query).toContain('t.CreatedAt >= ?');
      expect(query).toContain('t.CreatedAt <= ?');
      expect(query).toContain('LIMIT 10 OFFSET 20');
      expect(params).toContain('Completed');
      expect(params).toContain('2023-01-01');
      expect(params).toContain('2023-12-31');
    });

    test('should validate and limit query parameters', async () => {
      mockDbQuery
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ total: 0 }]]);

      await request(app)
        .get('/api/landlord/tickets')
        .query({
          limit: 1000, // Should be capped at 100
          offset: -5    // Should be set to 0
        })
        .set('Cookie', [`access_token=${mockAccessToken}`]);

      const [query] = mockDbQuery.mock.calls[0];
      expect(query).toContain('LIMIT 100 OFFSET 0');
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await request(app).get('/api/landlord/tickets');
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authenticated');
    });

    test('should return 403 for non-landlord user', async () => {
      // Mock token with different role
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue({
        sub: 123,
        role: 'Client', // Not a landlord
        jti: 'mock-jti'
      });

      const response = await authenticatedRequest();
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient privileges');
    });

    test('should handle database errors gracefully', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await authenticatedRequest();
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error fetching tickets');
      
      // Error details should only be included in development
      if (process.env.NODE_ENV === 'development') {
        expect(response.body.error).toBe('Database connection failed');
      }
    });

    test('should handle tickets without quotes or appointments', async () => {
      const mockTicketsWithoutQuotes = [
        {
          TicketID: 2,
          TicketRefNumber: 'TCKT-002',
          Description: 'Minor repair needed',
          UrgencyLevel: 'Low',
          CreatedAt: new Date('2023-01-20'),
          CurrentStatus: 'New',
          ClientName: 'Jane Smith',
          ClientEmail: 'jane@example.com',
          ClientPhone: null,
          QuoteID: null, // No quote
          ScheduleID: null // No appointment
        }
      ];

      mockDbQuery
        .mockResolvedValueOnce([mockTicketsWithoutQuotes])
        .mockResolvedValueOnce([[{ total: 1 }]]);

      const response = await authenticatedRequest();
      
      expect(response.status).toBe(200);
      const ticket = response.body.data.tickets[0];
      expect(ticket.quote).toBeNull();
      expect(ticket.nextAppointment).toBeNull();
      expect(ticket.client.phone).toBeNull();
    });
  });
});

// Integration test helper functions
export async function createTestLandlord() {
  const [result] = await pool.execute(
    `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status)
     VALUES (?, ?, ?, ?, ?)`,
    ['Test Landlord', 'landlord@test.com', 'hashed-password', 'Landlord', 'Active']
  );
  return result.insertId;
}

export async function createTestTicketWithQuote(clientId, landlordId) {
  // Create ticket
  const [ticketResult] = await pool.execute(
    `INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel)
     VALUES (?, ?, ?, ?)`,
    [clientId, `TCKT-TEST-${Date.now()}`, 'Test ticket description', 'Medium']
  );
  
  const ticketId = ticketResult.insertId;

  // Create contractor
  const [contractorResult] = await pool.execute(
    `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status)
     VALUES (?, ?, ?, ?, ?)`,
    ['Test Contractor', 'contractor@test.com', 'hashed-password', 'Contractor', 'Active']
  );
  
  const contractorId = contractorResult.insertId;

  // Create quote
  const [quoteResult] = await pool.execute(
    `INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteStatus)
     VALUES (?, ?, ?, ?)`,
    [ticketId, contractorId, 200.00, 'Pending']
  );
  
  const quoteId = quoteResult.insertId;

  // Create landlord approval
  await pool.execute(
    `INSERT INTO tblLandlordApprovals (QuoteID, LandlordUserID, ApprovalStatus)
     VALUES (?, ?, ?)`,
    [quoteId, landlordId, 'Approved']
  );

  return { ticketId, quoteId, contractorId };
}
