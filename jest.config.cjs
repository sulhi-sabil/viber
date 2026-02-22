module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/api"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  collectCoverageFrom: ["src/**/*.ts", "api/**/*.ts", "!src/**/*.d.ts", "!src/**/*.test.ts", "!api/**/*.test.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    "^uuid$": "<rootDir>/node_modules/uuid/dist/index.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Performance optimizations
  testTimeout: 30000, // 30 second timeout for slow integration tests
  maxWorkers: process.env.CI ? 2 : "50%", // Limit workers in CI for stability
  cache: true, // Enable test caching
  clearMocks: true, // Clear mock calls between tests
  restoreMocks: true, // Restore mock state between tests
};
