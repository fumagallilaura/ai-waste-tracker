import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the docker compose stack:
 *   docker compose up -d
 *   npm run test:e2e
 *
 * Override targets with E2E_BASE_URL / API_BASE_URL when needed.
 */
export default defineConfig({
  testDir: "./tests-e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
