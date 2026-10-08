import { expect, test } from "@playwright/test";
import { openApp, seedData } from "../helpers";

test.describe("PWA（オフライン）", () => {
  test("一度開いたあとは、オフラインでも起動でき、入力した値も保存される", async ({ page, context, browserName }) => {
    // Playwright の WebKit は、Service Worker 経由のオフライン再読み込みに対応していない（ツール側の制限）
    test.skip(browserName === "webkit", "WebKit ではオフライン再読み込みをテストできない");
    await openApp(page, seedData({ "2026-09": { h1: 1_000_000 } }));
    // Service Worker が準備できるまで待ち、もう一度読み込んで SW の管理下にする
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("¥1,000,000");

    await page.getByRole("button", { name: "編集", exact: true }).click();
    await page.locator("input[data-cell='h2:9']").fill("500000");
    await page.getByRole("button", { name: /^保存/ }).click();
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("¥1,500,000");
    await context.setOffline(false);
  });

  test("マニフェストとアイコンが配信されている", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status()).toBe(200);
    }
  });
});
