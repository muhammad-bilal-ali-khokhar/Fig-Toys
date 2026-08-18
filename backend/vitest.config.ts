import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./data/test.db",
      JWT_SECRET: "test-secret-at-least-16-chars-long",
      LOGIN_RATE_LIMIT_WINDOW_MS: "60000",
      LOGIN_RATE_LIMIT_MAX: "5",
    },
    globalSetup: "./tests/global-setup.ts",
    setupFiles: "./tests/setup.ts",
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
