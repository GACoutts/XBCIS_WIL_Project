import 'dotenv/config';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';
const TEST_USER = {
  fullName: 'Manual Test User',
  email: 'manual-test@example.com',
  password: 'testpassword123',
  role: 'Client'
};

let userCookies = '';

// Helper function to extract cookies from response
function extractCookies(response) {
  const setCookie = response.headers.get('set-cookie');
  return setCookie ? setCookie.split(',').map(c => c.split(';')[0]).join('; ') : '';
}

// Helper function to make authenticated requests
async function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userCookies,
      ...options.headers
    }
  });
}

async function runTests() {
  console.log('🧪 Starting Manual Integration Tests\n');

  try {
    // Test 1: Register new user
    console.log('1️⃣ Testing user registration...');
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    if (registerResponse.status === 201) {
      console.log('✅ Registration successful');
      userCookies = extractCookies(registerResponse);
      console.log(`   Cookies: ${userCookies.substring(0, 50)}...`);
    } else {
      console.log(`❌ Registration failed: ${registerResponse.status}`);
      const error = await registerResponse.text();
      console.log(`   Error: ${error}`);
    }

    // Test 2: Get current user
    console.log('\n2️⃣ Testing current user retrieval...');
    const meResponse = await authFetch(`${API_BASE}/auth/me`);
    
    if (meResponse.status === 200) {
      const user = await meResponse.json();
      console.log('✅ User retrieval successful');
      console.log(`   User: ${user.user.fullName} (${user.user.email})`);
    } else {
      console.log(`❌ User retrieval failed: ${meResponse.status}`);
    }

    // Test 3: List active sessions
    console.log('\n3️⃣ Testing session listing...');
    const sessionsResponse = await authFetch(`${API_BASE}/auth/sessions`);
    
    if (sessionsResponse.status === 200) {
      const sessions = await sessionsResponse.json();
      console.log('✅ Session listing successful');
      console.log(`   Active sessions: ${sessions.sessions.length}`);
      if (sessions.sessions.length > 0) {
        const session = sessions.sessions[0];
        console.log(`   Latest session: ${session.tokenId} from ${session.ip || 'unknown'}`);
      }
    } else {
      console.log(`❌ Session listing failed: ${sessionsResponse.status}`);
    }

    // Test 4: Token refresh
    console.log('\n4️⃣ Testing token refresh...');
    const refreshResponse = await authFetch(`${API_BASE}/auth/refresh`, {
      method: 'POST'
    });
    
    if (refreshResponse.status === 200) {
      console.log('✅ Token refresh successful');
      const newCookies = extractCookies(refreshResponse);
      if (newCookies) {
        userCookies = newCookies;
        console.log('   New tokens received');
      }
    } else {
      console.log(`❌ Token refresh failed: ${refreshResponse.status}`);
    }

    // Test 5: Password reset request
    console.log('\n5️⃣ Testing password reset request...');
    const resetRequestResponse = await fetch(`${API_BASE}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email })
    });
    
    if (resetRequestResponse.status === 200) {
      const result = await resetRequestResponse.json();
      console.log('✅ Password reset request successful');
      console.log(`   Message: ${result.message}`);
    } else {
      console.log(`❌ Password reset request failed: ${resetRequestResponse.status}`);
    }

    // Test 6: Rate limiting check
    console.log('\n6️⃣ Testing rate limiting headers...');
    const rateLimitResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@example.com', password: 'wrong' })
    });
    
    const rateLimitHeaders = {
      limit: rateLimitResponse.headers.get('x-ratelimit-limit'),
      remaining: rateLimitResponse.headers.get('x-ratelimit-remaining'),
      reset: rateLimitResponse.headers.get('x-ratelimit-reset')
    };
    
    if (rateLimitHeaders.limit) {
      console.log('✅ Rate limiting active');
      console.log(`   Limit: ${rateLimitHeaders.limit}, Remaining: ${rateLimitHeaders.remaining}`);
    } else {
      console.log('⚠️ Rate limiting headers not found');
    }

    // Test 7: Logout
    console.log('\n7️⃣ Testing logout...');
    const logoutResponse = await authFetch(`${API_BASE}/auth/logout`, {
      method: 'POST'
    });
    
    if (logoutResponse.status === 200) {
      console.log('✅ Logout successful');
      userCookies = ''; // Clear cookies
    } else {
      console.log(`❌ Logout failed: ${logoutResponse.status}`);
    }

    // Test 8: Verify logout (should fail)
    console.log('\n8️⃣ Testing post-logout access (should fail)...');
    const postLogoutResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Cookie': userCookies }
    });
    
    if (postLogoutResponse.status === 401) {
      console.log('✅ Post-logout access properly denied');
    } else {
      console.log(`❌ Post-logout access not denied: ${postLogoutResponse.status}`);
    }

    console.log('\n🎉 Manual integration tests completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Check if server is running, if not start it
async function checkServerAndRun() {
  try {
    const healthCheck = await fetch(`${API_BASE}/health`);
    if (healthCheck.ok) {
      console.log('✅ Server is already running');
      await runTests();
    } else {
      throw new Error('Server health check failed');
    }
  } catch (error) {
    console.log('⚠️ Server not running, please start it first:');
    console.log('   npm run dev');
    console.log('\nThen run this test again:');
    console.log('   node test/manual-integration.js');
  }
}

checkServerAndRun();
