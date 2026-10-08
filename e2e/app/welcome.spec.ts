import { expect, test } from "@playwright/test";
import { openApp, seedData } from "../helpers";

test.describe("初回の紹介カード", () => {
  test("初めて開くと表示され、「使い方を見る」でヘルプが開く。「はじめる」で閉じると、次からは出ない", async ({ page }) => {
    await openApp(page, seedData({}), { welcome: true });
    const card = page.getByRole("region", { name: "TAMERU の紹介" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("無料・登録なしですぐ使える");

    await card.getByRole("button", { name: "使い方を見る" }).click();
    const help = page.getByRole("dialog", { name: "ヘルプ" });
    await expect(help).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();

    await card.getByRole("button", { name: "はじめる" }).click();
    await expect(card).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "資産入力" })).toBeVisible();
    await expect(page.getByRole("region", { name: "TAMERU の紹介" })).toBeHidden();
  });

  test("×でも閉じられる", async ({ page }) => {
    await openApp(page, seedData({}), { welcome: true });
    await page.getByRole("button", { name: "紹介を閉じる" }).click();
    await expect(page.getByRole("region", { name: "TAMERU の紹介" })).toBeHidden();
  });

  test("金額が入力済み（すでに使っている人）には表示しない", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 100 } }), { welcome: true });
    await expect(page.getByRole("region", { name: "サマリー" })).toBeVisible();
    await expect(page.getByRole("region", { name: "TAMERU の紹介" })).toBeHidden();
  });
});

test.describe("共有時のプレビュー・検索エンジン向けの設定", () => {
  test("プレビューの画像・タイトル・説明文が設定されている", async ({ page, request }) => {
    await page.goto("/");
    const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
    expect(await meta('meta[property="og:title"]')).toContain("TAMERU");
    expect(await meta('meta[property="og:description"]')).toContain("口座連携不要");
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    const image = await meta('meta[property="og:image"]');
    expect(image).toMatch(/^https:\/\/tameru-lovat\.vercel\.app\/opengraph-image/);
    // 画像そのものが配信されている（ドメイン部分は手元のサーバーに置き換えて確認）
    const res = await request.get(new URL(image!).pathname + new URL(image!).search);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  });

  test("robots.txt と sitemap.xml が配信されている", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /__/");
    expect(robots).toContain("Sitemap: https://tameru-lovat.vercel.app/sitemap.xml");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://tameru-lovat.vercel.app/privacy</loc>");
  });
});
