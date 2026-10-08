import { expect, test } from "@playwright/test";
import { openApp, seedData } from "../helpers";

test("ヘルプを開くと4項目が表示され、閉じられる", async ({ page }) => {
  await openApp(page, seedData({}));
  await page.getByRole("button", { name: "ヘルプ" }).click();

  const dialog = page.getByRole("dialog", { name: "ヘルプ" });
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveText([
    "TAMERU でできること",
    "最初にすること",
    "データの保存場所",
    "スマホのホーム画面に追加する",
  ]);
  await expect(dialog.getByRole("heading", { level: 4, name: "iPhone（Safari）" })).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 4, name: "Android（Chrome）" })).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 4, name: "スプレッドシートから移すとき" })).toBeVisible();
  await expect(dialog.getByText("「② 取り込む」に貼り付けて「取り込む」→「保存」を押します")).toBeVisible();
  await expect(dialog.getByText("Google ログイン後にログアウトしても、クラウドのデータは残ります")).toBeVisible();
  await expect(dialog.getByText("iPhone では、ホーム画面に追加するか、Google でログインしてください", { exact: false })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
