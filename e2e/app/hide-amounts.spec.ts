import { expect, test, type Page } from "@playwright/test";
import { cell, openApp, seedData, tab } from "../helpers";

// 総資産 3,480,000（2026年9月）。前月（8月）は 3,000,000
const data = () =>
  seedData({
    "2026-08": { h1: 1_000_000, h2: 1_500_000, h3: 500_000 },
    "2026-09": { h1: 1_000_000, h2: 2_000_000, h3: 480_000 },
  });

const toggle = (page: Page) => page.getByRole("button", { name: /^金額を(隠す|表示)$/ });
const summary = (page: Page) => page.getByRole("region", { name: "サマリー" });
const allocationPanel = (page: Page) =>
  page.locator("section", { has: page.getByRole("heading", { name: "ポートフォリオ構成比" }) });
const mainText = (page: Page) => page.locator("main").innerText();

test.describe("金額を隠すモード", () => {
  test("ホーム: 金額は ¥***** になり、増減率・構成比（%）は残る", async ({ page }) => {
    await openApp(page, data());
    await expect(summary(page)).toContainText("¥3,480,000");

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(page)).toHaveAccessibleName("金額を表示");
    await expect(summary(page)).toContainText("¥*****");
    await expect(summary(page)).toContainText("+16.00%"); // 前月比の率は残る
    await expect(allocationPanel(page)).toContainText("%");

    // 画面のどこにも金額（3桁区切りの数字や「万」）が出ていない
    const text = await mainText(page);
    expect(text).not.toMatch(/\d{1,3}(,\d{3})+/);
    expect(text).not.toMatch(/\d+万/);
  });

  test("隠した状態は端末に覚えておき、記録の画面でも隠れる。編集中だけ表示され、終わると隠れる", async ({ page }) => {
    await openApp(page, data());
    await toggle(page).click();
    await page.reload();
    await expect(summary(page)).toContainText("¥*****"); // 開き直しても隠したまま

    await tab(page, "記録").click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("tfoot")).toContainText("*****");
    await expect(page.locator("tfoot")).not.toContainText("3,480,000");

    // 編集中は入力できるように表示する
    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(toggle(page)).toBeHidden();
    await expect(cell(page, "h1", 9)).toHaveValue("1,000,000");
    await expect(page.locator("tfoot")).toContainText("3,480,000");
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(page.locator("tfoot")).toContainText("*****");
    await expect(page.locator("tfoot")).not.toContainText("3,480,000");
  });

  test("もう一度押すと表示に戻り、次に開いたときも表示のまま", async ({ page }) => {
    await openApp(page, data());
    await toggle(page).click();
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(summary(page)).toContainText("¥3,480,000");
    await page.reload();
    await expect(summary(page)).toContainText("¥3,480,000");
  });

  test("グラフの拡大表示でも金額は隠れている", async ({ page }) => {
    await openApp(page, data());
    await toggle(page).click();
    await allocationPanel(page).getByRole("button", { name: "拡大表示" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("¥*****");
    await expect(dialog).toContainText("%");
    expect(await dialog.innerText()).not.toMatch(/\d{1,3}(,\d{3})+/);
  });
});
