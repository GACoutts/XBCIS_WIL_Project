import 'dotenv/config';

// Set test timeouts
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_ACCESS_EXPIRES = '5m';
process.env.JWT_REFRESH_EXPIRES = '1h';
process.env.BCRYPT_ROUNDS = '4'; // Faster for tests

// Suppress console logs during tests unless there's an error
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = () => {}; // Silence logs
  console.error = originalConsoleError; // Keep errors visible
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});
