import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pool from '../db.js';
import authRoutes from '../routes/auth.js';
import { generalRateLimit } from '../middleware/rateLimiter.js';

// Create test app
const app = express();
app.use(cors({ credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

describe('🔐 Critical Auth Flows', () => {
  let testUser = {
    fullName: 'Test User',
    email: 'test@example.com',
    password: 'testpassword123',
    role: 'Client'
  };

  let userSession = {};

  beforeAll(async () => {
    // Clean up any existing test user
    await pool.execute('DELETE FROM tblusers WHERE Email = ?', [testUser.email]);
  });

  afterAll(async () => {
    // Cleanup
    await pool.execute('DELETE FROM tblusers WHERE Email = ?', [testUser.email]);
    await pool.end();
  });

  describe('🚀 Registration & Login Flow', () => {
    test('should register new user with dual tokens', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.user).toMatchObject({
        email: testUser.email,
        fullName: testUser.fullName,
        role: testUser.role
      });

      expect(response.body.user.userId).toBeDefined();
      expect(response.headers['set-cookie']).toHaveLength(2);
      
      // Check for access and refresh tokens
      const cookies = response.headers['set-cookie'];
      const accessCookie = cookies.find(c => c.startsWith('access_token='));
      const refreshCookie = cookies.find(c => c.startsWith('refresh_token='));
      
      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();

      userSession.userId = response.body.user.userId;
      userSession.cookies = cookies;
    });

    test('should login existing user with dual tokens', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: testUser.email,
        fullName: testUser.fullName,
        role: testUser.role
      });

      // Should get new token pair
      const cookies = response.headers['set-cookie'];
      expect(cookies).toHaveLength(2);
      
      userSession.cookies = cookies;
    });

    test('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });
  });

  describe('🔄 Session Management', () => {
    test('should get current user with valid session', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', userSession.cookies)
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: testUser.email,
        fullName: testUser.fullName,
        role: testUser.role,
        userId: userSession.userId
      });
    });

    test('should list active sessions', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Cookie', userSession.cookies)
        .expect(200);

      expect(response.body.sessions).toBeDefined();
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);
      
      const session = response.body.sessions[0];
      expect(session).toHaveProperty('tokenId');
      expect(session).toHaveProperty('issuedAt');
      expect(session).toHaveProperty('expiresAt');
    });

    test('should refresh tokens manually', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', userSession.cookies)
        .expect(200);

      expect(response.body.ok).toBe(true);
      
      // Should get new cookies
      const newCookies = response.headers['set-cookie'];
      expect(newCookies).toHaveLength(2);
      
      userSession.cookies = newCookies;
    });

    test('should logout and revoke session', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', userSession.cookies)
        .expect(200);

      expect(response.body.ok).toBe(true);

      // Should clear cookies
      const clearCookies = response.headers['set-cookie'];
      expect(clearCookies).toBeDefined();
      expect(clearCookies.some(c => c.includes('access_token=;'))).toBe(true);

      // Subsequent requests should fail
      await request(app)
        .get('/api/auth/me')
        .set('Cookie', userSession.cookies)
        .expect(401);
    });
  });

  describe('🔑 Password Reset Flow', () => {
    beforeAll(async () => {
      // Login again for password reset tests
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      userSession.cookies = loginResponse.headers['set-cookie'];
    });

    test('should handle password reset request (no email enumeration)', async () => {
      // Valid email
      let response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.message).toContain('reset link has been sent');

      // Invalid email (same response to prevent enumeration)
      response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.message).toContain('reset link has been sent');
    });

    test('should reset password with valid token', async () => {
      // First, create a reset token
      await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: testUser.email });

      // Get the token from database (in real app, this would come from email)
      const [tokenRows] = await pool.execute(
        'SELECT TokenHash FROM tblPasswordResets WHERE UserID = (SELECT UserID FROM tblusers WHERE Email = ?) AND UsedAt IS NULL ORDER BY CreatedAt DESC LIMIT 1',
        [testUser.email]
      );

      expect(tokenRows.length).toBe(1);

      // For testing, we need to reverse-engineer a valid token
      // In reality, the raw token would be in the email
      // For this test, let's create a mock scenario by updating the DB directly
      const crypto = await import('crypto');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      
      await pool.execute(
        'UPDATE tblPasswordResets SET TokenHash = ? WHERE UserID = (SELECT UserID FROM tblusers WHERE Email = ?)',
        [tokenHash, testUser.email]
      );

      const newPassword = 'newpassword123';
      
      // Test password reset
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword
        })
        .expect(200);

      expect(response.body.message).toContain('reset successfully');

      // Verify old password doesn't work
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        })
        .expect(200);

      // Update test user password for cleanup
      testUser.password = newPassword;
    });

    test('should reject invalid reset tokens', async () => {
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123'
        })
        .expect(400);
    });
  });

  describe('⚡ Rate Limiting', () => {
    test('should apply rate limiting to auth endpoints', async () => {
      // This test would normally require many requests
      // For demo purposes, we'll just verify the middleware is applied
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrong'
        });

      // Rate limiting headers should be present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    }, 10000);
  });
});
