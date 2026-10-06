import { expect, test } from "@playwright/test";
import { openApp, seedData } from "../helpers";

test.describe("プライバシーポリシー・利用規約", () => {
  test("画面下のリンクから各ページを開き、TAMERU に戻れる", async ({ page }) => {
    await openApp(page, seedData({}));
    const footer = page.getByRole("navigation", { name: "サイト情報" });

    await footer.getByRole("link", { name: "プライバシーポリシー" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "プライバシーポリシー" })).toBeVisible();
    await expect(page.getByText("TAMERU 運営（以下「運営者」）")).toBeVisible();
    await expect(page.getByRole("heading", { name: "4. 外部サービスの利用" })).toBeVisible();

    await page.getByRole("navigation", { name: "サイト情報" }).getByRole("link", { name: "利用規約" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "利用規約" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. 投資助言ではないこと" })).toBeVisible();

    await page.getByRole("link", { name: "TAMERU に戻る" }).click();
    await expect(page.getByRole("heading", { name: "資産入力" })).toBeVisible();
  });

  test("ログイン前の説明画面に、規約への同意とリンクが表示される", async ({ page }) => {
    await openApp(page, seedData({}));
    await page.getByRole("button", { name: /ログイン/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Google でログインして同期" });
    await expect(dialog.getByText(/に同意したものとみなします/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    await expect(dialog.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
    await expect(dialog.getByText("TAMERU が利用するのはメールアドレスだけです", { exact: false })).toBeVisible();
  });
});
