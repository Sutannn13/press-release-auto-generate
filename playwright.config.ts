import { defineConfig } from "@playwright/test";

const PORT = 3_100;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    },
  },
});
