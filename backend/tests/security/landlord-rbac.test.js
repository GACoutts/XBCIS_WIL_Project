// backend/tests/security/landlord-rbac.test.js
// Comprehensive RBAC security tests for landlord lifecycle hardening

import request from 'supertest';
import app from '../../server.js';
import pool from '../../db.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/tokens.js';

describe('Landlord RBAC Security Tests', () => {
  let landlordUser, otherLandlordUser, contractorUser, staffUser, clientUser;
  let landlordToken, otherLandlordToken, contractorToken, staffToken, clientToken;
  let testTicket, testQuote, testProperty;

  beforeAll(async () => {
    // Setup test users
    const [landlord] = await pool.execute(
      `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
       VALUES ('Test Landlord', 'landlord@test.com', 'hash', 'Landlord', 'Active')`
    );
    landlordUser = { userId: landlord.insertId, role: 'Landlord' };
    landlordToken = generateAccessToken(landlordUser);

    const [otherLandlord] = await pool.execute(
      `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
       VALUES ('Other Landlord', 'other@test.com', 'hash', 'Landlord', 'Active')`
    );
    otherLandlordUser = { userId: otherLandlord.insertId, role: 'Landlord' };
    otherLandlordToken = generateAccessToken(otherLandlordUser);

    const [contractor] = await pool.execute(
      `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
       VALUES ('Test Contractor', 'contractor@test.com', 'hash', 'Contractor', 'Active')`
    );
    contractorUser = { userId: contractor.insertId, role: 'Contractor' };
    contractorToken = generateAccessToken(contractorUser);

    const [staff] = await pool.execute(
      `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
       VALUES ('Test Staff', 'staff@test.com', 'hash', 'Staff', 'Active')`
    );
    staffUser = { userId: staff.insertId, role: 'Staff' };
    staffToken = generateAccessToken(staffUser);

    const [client] = await pool.execute(
      `INSERT INTO tblusers (FullName, Email, PasswordHash, Role, Status) 
       VALUES ('Test Client', 'client@test.com', 'hash', 'Client', 'Active')`
    );
    clientUser = { userId: client.insertId, role: 'Client' };
    clientToken = generateAccessToken(clientUser);

    // Setup test data
    const [property] = await pool.execute(
      `INSERT INTO tblProperties (Address, City, PostalCode) 
       VALUES ('123 Test St', 'Test City', '12345')`
    );
    testProperty = property.insertId;

    // Link property to first landlord only
    await pool.execute(
      `INSERT INTO tblLandlordProperties (LandlordUserID, PropertyID, ActiveFrom) 
       VALUES (?, ?, NOW())`,
      [landlordUser.userId, testProperty]
    );

    const [ticket] = await pool.execute(
      `INSERT INTO tblTickets (PropertyID, ClientUserID, Description, UrgencyLevel, CurrentStatus) 
       VALUES (?, ?, 'Test ticket', 'Medium', 'Open')`,
      [testProperty, clientUser.userId]
    );
    testTicket = ticket.insertId;

    const [quote] = await pool.execute(
      `INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteDescription) 
       VALUES (?, ?, 1000, 'Test quote')`,
      [testTicket, contractorUser.userId]
    );
    testQuote = quote.insertId;
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.execute('DELETE FROM tblLandlordApprovals WHERE QuoteID = ?', [testQuote]);
    await pool.execute('DELETE FROM tblQuotes WHERE QuoteID = ?', [testQuote]);
    await pool.execute('DELETE FROM tblTickets WHERE TicketID = ?', [testTicket]);
    await pool.execute('DELETE FROM tblLandlordProperties WHERE PropertyID = ?', [testProperty]);
    await pool.execute('DELETE FROM tblProperties WHERE PropertyID = ?', [testProperty]);
    await pool.execute('DELETE FROM tblusers WHERE UserID IN (?, ?, ?, ?, ?)', [
      landlordUser.userId, otherLandlordUser.userId, contractorUser.userId, 
      staffUser.userId, clientUser.userId
    ]);
    await pool.end();
  });

  describe('Admin Routes RBAC Tests', () => {
    const adminEndpoints = [
      'GET /api/admin/users',
      'GET /api/admin/contractors/active', 
      'POST /api/admin/contractor-assign',
      'GET /api/admin/users/1',
      'PUT /api/admin/users/1/status',
      'GET /api/admin/audit-logs',
      'GET /api/admin/stats',
      'GET /api/admin/inactive-users'
    ];

    test.each(adminEndpoints)('Non-staff user should get 403 for %s', async (endpoint) => {
      const [method, path] = endpoint.split(' ');
      const reqBody = method === 'POST' ? { TicketID: 1, ContractorUserID: 1 } : 
                     method === 'PUT' ? { status: 'Active' } : undefined;

      // Test with each non-staff role
      for (const { token, role } of [
        { token: landlordToken, role: 'Landlord' },
        { token: contractorToken, role: 'Contractor' },
        { token: clientToken, role: 'Client' }
      ]) {
        const response = await request(app)
          [method.toLowerCase()](path)
          .set('Cookie', `accessToken=${token}`)
          .send(reqBody);

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/(?:not authorized|insufficient permissions|staff required)/i);
      }
    });

    test('Staff user should have access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `accessToken=${staffToken}`);

      expect(response.status).not.toBe(403);
    });
  });

  describe('Landlord Data Scoping Tests', () => {
    test('Landlord can access their own property tickets', async () => {
      const response = await request(app)
        .get('/api/landlord/tickets')
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should include the test ticket for their property
      const ticketIds = response.body.data.tickets.map(t => t.ticketId);
      expect(ticketIds).toContain(testTicket);
    });

    test('Other landlord cannot access different property tickets', async () => {
      const response = await request(app)
        .get('/api/landlord/tickets')
        .set('Cookie', `accessToken=${otherLandlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should NOT include the test ticket (different landlord)
      const ticketIds = response.body.data.tickets.map(t => t.ticketId);
      expect(ticketIds).not.toContain(testTicket);
    });

    test('Landlord can access quotes for their property ticket', async () => {
      const response = await request(app)
        .get(`/api/landlord/quotes/${testTicket}`)
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Other landlord gets 403 for different property ticket quotes', async () => {
      const response = await request(app)
        .get(`/api/landlord/quotes/${testTicket}`)
        .set('Cookie', `accessToken=${otherLandlordToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/not allowed|access denied/i);
    });

    test('Landlord can approve quotes for their properties', async () => {
      const response = await request(app)
        .post(`/api/landlord/quotes/${testQuote}/approve`)
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Other landlord gets 403 when approving different property quotes', async () => {
      const response = await request(app)
        .post(`/api/landlord/quotes/${testQuote}/approve`)
        .set('Cookie', `accessToken=${otherLandlordToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/not allowed|access denied/i);
    });
  });

  describe('Role-Based Access Tests', () => {
    test('Contractor cannot access landlord endpoints', async () => {
      const endpoints = [
        `/api/landlord/tickets`,
        `/api/landlord/quotes/${testTicket}`,
        `/api/landlord/tickets/${testTicket}/appointments`
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Cookie', `accessToken=${contractorToken}`);

        expect(response.status).toBe(403);
      }
    });

    test('Client cannot access landlord endpoints', async () => {
      const response = await request(app)
        .get('/api/landlord/tickets')
        .set('Cookie', `accessToken=${clientToken}`);

      expect(response.status).toBe(403);
    });

    test('Unauthenticated requests get 401', async () => {
      const response = await request(app)
        .get('/api/landlord/tickets');

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation Tests', () => {
    test('Invalid ticket ID returns 400', async () => {
      const response = await request(app)
        .get('/api/landlord/quotes/invalid')
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('Negative ticket ID returns 400', async () => {
      const response = await request(app)
        .get('/api/landlord/quotes/-1')
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('Invalid pagination parameters return 400', async () => {
      const response = await request(app)
        .get('/api/landlord/tickets?limit=1000&offset=-1')
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('Invalid date format returns 400', async () => {
      const response = await request(app)
        .get('/api/landlord/tickets?dateFrom=invalid-date')
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Edge Cases and Boundary Tests', () => {
    test('Non-existent ticket ID returns 403 (not 404) for security', async () => {
      const response = await request(app)
        .get('/api/landlord/quotes/99999')
        .set('Cookie', `accessToken=${landlordToken}`);

      // Should return 403 (access denied) rather than 404 to prevent info disclosure
      expect(response.status).toBe(403);
    });

    test('Expired property assignment prevents access', async () => {
      // Set property assignment to expired
      await pool.execute(
        'UPDATE tblLandlordProperties SET ActiveTo = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE PropertyID = ?',
        [testProperty]
      );

      const response = await request(app)
        .get('/api/landlord/tickets')
        .set('Cookie', `accessToken=${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tickets).toHaveLength(0);

      // Reset for other tests
      await pool.execute(
        'UPDATE tblLandlordProperties SET ActiveTo = NULL WHERE PropertyID = ?',
        [testProperty]
      );
    });
  });
});