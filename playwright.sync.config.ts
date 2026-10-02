import { defineConfig, devices } from "@playwright/test";

/**
 * ログイン・同期の自動テスト。Firebase エミュレーターに接続するテスト用ビルド（.next-e2e）を起動して操作する。
 * 実行: npm run test:e2e:sync（エミュレーターの起動・ビルドも自動で行う）
 */
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e/sync",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // エミュレーターのデータを共有するため、1つずつ実行する
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-sync" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
