export default {
  preset: 'default',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!**/__tests__/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
