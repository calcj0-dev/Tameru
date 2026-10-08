import { defineConfig, devices } from "@playwright/test";

/**
 * 画面操作の自動テスト（E2E）。本番ビルド（next build）を起動して、ブラウザで操作する。
 * - desktop / mobile: ログインなしの画面操作（e2e/app/）
 * ログイン・同期のテストは別の設定（playwright.sync.config.ts / npm run test:e2e:sync）
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", testDir: "./e2e/app", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 1000 } } },
    { name: "mobile", testDir: "./e2e/app", use: { ...devices["Pixel 7"] } },
    { name: "iphone", testDir: "./e2e/app", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
