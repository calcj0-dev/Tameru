import { expect, test } from "@playwright/test";
import { cell, openApp, seedData, storedMonth } from "../helpers";

test.describe("スプレッドシート連携", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openApp(page, seedData({ "2026-01": { h1: 100 } }));
    await page.getByRole("button", { name: "編集", exact: true }).click();
    await page.getByRole("button", { name: "スプレッドシート連携" }).click();
  });

  test("① アプリの口座・内訳に合わせた表を出力（コピー）できる", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "スプレッドシートと連携" });
    await expect(dialog.getByText("先に、TAMERU の表で口座と内訳（資産クラス・地域も）を作っておきます")).toBeVisible();
    await dialog.getByRole("button", { name: "表をコピー" }).click();
    await expect(dialog.getByRole("button", { name: "コピーしました" })).toBeVisible();
    const tsv = await page.evaluate(() => navigator.clipboard.readText());
    const rows = tsv.split("\n").map((r) => r.split("\t"));
    expect(rows[0].slice(0, 3)).toEqual(["口座名", "メモ", "2026年1月"]);
    expect(rows[1].slice(0, 3)).toEqual(["銀行", "普通預金", "100"]);
    expect(rows).toHaveLength(1 + 3);

    // 期間を変えると列が増える
    await dialog.getByRole("combobox", { name: "開始年" }).selectOption("2025");
    await dialog.getByRole("button", { name: "表をコピー" }).click();
    const tsv2 = await page.evaluate(() => navigator.clipboard.readText());
    expect(tsv2.split("\n")[0].split("\t")).toHaveLength(2 + 24);
  });

  test("② 加工した表を貼り付けて取り込み → 表に反映 → 元に戻す・やり直す → 保存", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "スプレッドシートと連携" });
    await dialog.getByRole("tab", { name: /取り込む/ }).click();
    const pasted = [
      ["口座名", "メモ", "2026年1月", "2026年2月"],
      ["SBI証券", "米国株", "3,000", "3,500"], // 行の順番は入れ替えてもよい
      ["銀行", "普通預金", "", "150"], // 空欄は変更しない（1月は100のまま）
    ]
      .map((r) => r.join("\t"))
      .join("\n");
    await dialog.getByRole("textbox", { name: "貼り付ける表" }).fill(pasted);
    await expect(dialog.getByRole("status")).toContainText("3セル");
    await dialog.getByRole("button", { name: "取り込む" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(/スプレッドシートから 3 セルを取り込みました/)).toBeVisible();
    await expect(cell(page, "h3", 2)).toHaveValue("3,500");
    await expect(cell(page, "h1", 1)).toHaveValue("100");

    // 取り込みは「元に戻す」1回でまとめて取り消せる
    await page.getByRole("button", { name: "元に戻す" }).click();
    await expect(cell(page, "h3", 2)).toHaveValue("");
    await page.getByRole("button", { name: "やり直す" }).click();
    await expect(cell(page, "h3", 2)).toHaveValue("3,500");

    await page.getByRole("button", { name: /^保存/ }).click();
    expect(await storedMonth(page, 2026, 2)).toEqual({ h1: 150, h2: 0, h3: 3500 });
  });

  test("問題がある表はエラーを表示し、取り込めない", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "スプレッドシートと連携" });
    await dialog.getByRole("tab", { name: /取り込む/ }).click();
    const box = dialog.getByRole("textbox", { name: "貼り付ける表" });

    await box.fill("銀行\t100");
    await expect(dialog.getByRole("status")).toContainText("見出しの行");
    await expect(dialog.getByRole("button", { name: "取り込む" })).toBeDisabled();

    await box.fill(["口座名\tメモ\t2026年3月", "楽天証券\tS&P500\t1", "銀行\t普通預金\tabc"].join("\n"));
    const status = dialog.getByRole("status");
    await expect(status).toContainText("2行目");
    await expect(status).toContainText("3行目");
    await expect(dialog.getByRole("button", { name: "取り込む" })).toBeDisabled();
  });

  test("ダイアログ内の Ctrl+Z は表の「元に戻す」にならない", async ({ page, isMobile }) => {
    test.skip(isMobile, "キーボード操作は PC のみ");
    await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
    await cell(page, "h1", 1).fill("999");
    await page.getByRole("button", { name: "スプレッドシート連携" }).click();
    const dialog = page.getByRole("dialog", { name: "スプレッドシートと連携" });
    await dialog.getByRole("tab", { name: /取り込む/ }).click();
    await dialog.getByRole("textbox", { name: "貼り付ける表" }).fill("abc");
    await page.keyboard.press("Control+z");
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await expect(cell(page, "h1", 1)).toHaveValue("999");
  });
});
