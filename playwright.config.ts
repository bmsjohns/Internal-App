import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:3211", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: "node_modules/.bin/next dev -H 127.0.0.1 -p 3211",
    url: "http://127.0.0.1:3211/orders",
    env: { DEV_AUTH_BYPASS: "1", DATA_SOURCE: "mock" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
