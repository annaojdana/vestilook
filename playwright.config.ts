import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const STORAGE_STATE = path.resolve(process.cwd(), "tests/e2e/.auth/state.json");
const GLOBAL_SETUP = path.resolve(process.cwd(), "tests/e2e/global-setup.ts");
const GLOBAL_TEARDOWN = path.resolve(process.cwd(), "tests/e2e/global-teardown.ts");

export default defineConfig({
  testDir: path.resolve(process.cwd(), "tests/e2e"),
  globalSetup: GLOBAL_SETUP,
  globalTeardown: GLOBAL_TEARDOWN,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
    {
      name: "mobile-chrome",
      use: devices["Pixel 7"],
    },
    {
      name: "mobile-safari",
      use: devices["iPhone 14 Pro"],
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: "npm run dev:e2e",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
