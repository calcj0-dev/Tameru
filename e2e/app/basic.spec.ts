import { expect, test } from "@playwright/test";
import { openApp, seedData, STORAGE_KEY, storedData } from "../helpers";

test.describe("起動・表示", () => {
  test("初回起動: サンプル口座が表示され、参照のみ・未入力の状態で始まる", async ({ page }) => {
    await openApp(page, null);
    await expect(page.getByRole("heading", { name: "TAMERU" })).toBeVisible();
    await expect(page.getByText(/^v\d+\.\d+\.\d+$/)).toBeVisible(); // バージョン表示
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("まだデータが入力されていません");
    await expect(page.getByRole("button", { name: "編集", exact: true })).toBeVisible();
    await expect(page.locator("input[data-cell]")).toHaveCount(0); // 参照のみ: 入力欄なし
    await expect(page.getByText("SBI証券")).toBeVisible();
  });

  test("保存データがあればサマリー・合計に反映される", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 1_000_000, h2: 2_000_000, h3: 480_000 } }));
    const summary = page.getByRole("region", { name: "サマリー" });
    await expect(summary).toContainText("¥3,480,000");
    await expect(summary).toContainText("2026年9月末時点");
    await expect(page.locator("tfoot")).toContainText("3,480,000");
  });

  test("旧形式（v2）のデータは自動で新しい形式に変換され、変換前のデータはバックアップされる", async ({ page }) => {
    await openApp(page, {
      version: 2,
      data: {
        accounts: [
          { id: "r1", name: "SBI証券", category: "jp_stock" },
          { id: "r2", name: "SBI証券", category: "us_stock" },
        ],
        yearlyData: { 2026: { year: 2026, monthlyAmounts: { 9: { r1: 100, r2: 200 } } } },
      },
    });
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("¥300");
    const stored = await storedData(page);
    expect(stored.version).toBe(3);
    expect(stored.data.accounts).toHaveLength(1); // 同じ名前の行は1口座にまとまる
    expect(stored.data.accounts[0].holdings).toHaveLength(2);
    expect(await page.evaluate((k) => localStorage.getItem(`${k}:backup:v2`) !== null, STORAGE_KEY)).toBe(true);
  });

  test("壊れたデータは消さずに退避し、初期データで起動する", async ({ page }) => {
    // アプリを読み込まないページで壊れたデータを入れてから、アプリを開く
    await page.goto("/manifest.webmanifest");
    await page.evaluate((k) => localStorage.setItem(k, "{broken json"), STORAGE_KEY);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "資産入力" })).toBeVisible();
    const backups = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("tameru:store:backup:")));
    expect(backups.length).toBeGreaterThan(0);
  });

  test("画面が横にはみ出さない", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 123_456_789 } }));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("ログイン（ログイン前の説明画面）", () => {
  test("ログインボタンで説明画面が開き、キャンセルで閉じる。Google には通信しない", async ({ page }) => {
    const googleRequests: string[] = [];
    page.on("request", (r) => {
      if (/google|firebase/.test(new URL(r.url()).host)) googleRequests.push(r.url());
    });
    await openApp(page, null);
    expect(googleRequests).toEqual([]); // 未ログインの間は外部に通信しない

    await page.getByRole("button", { name: /ログイン/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Google でログインして同期" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("メールアドレスだけ");
    await expect(dialog).toContainText("ログアウトしても、この端末のデータは消えません");
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).toBeHidden();
  });
});
