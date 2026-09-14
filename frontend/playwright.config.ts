import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the docker compose stack:
 *   docker compose up -d
 *   npm run test:e2e
 *
 * Override targets with E2E_BASE_URL / API_BASE_URL when needed.
 */
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const originForStorage = new URL(baseURL).origin;

export default defineConfig({
  testDir: "./tests-e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    trace: "retain-on-failure",
    // pré-marca o tutorial como visto pra ele não cobrir a UI nos testes
    storageState: {
      cookies: [],
      origins: [
        {
          origin: originForStorage,
          localStorage: [{ name: "tour_v3_done", value: "1" }],
        },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
