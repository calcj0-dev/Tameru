import { expect, test, type Page } from "@playwright/test";
import { openApp, seedData, storedData } from "../helpers";

const accountNames = (page: Page) => page.locator("[data-account-name]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
const holdingMemos = (page: Page) => page.locator("[data-holding-memo]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

test.describe("口座・内訳の並び替え", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 100, h2: 200, h3: 300 } }));
    await page.getByRole("button", { name: "編集", exact: true }).click();
  });

  test("口座と内訳を↑↓で並び替えて保存すると、順番が保存される。金額はそのまま", async ({ page }) => {
    expect(await accountNames(page)).toEqual(["銀行", "SBI証券"]);
    // 先頭の口座には「上へ」、末尾の口座には「下へ」を表示しない
    await expect(page.getByRole("button", { name: "口座「銀行」を上へ移動" })).toBeHidden();
    await expect(page.getByRole("button", { name: "口座「SBI証券」を下へ移動" })).toBeHidden();

    await page.getByRole("button", { name: "口座「銀行」を下へ移動" }).click();
    expect(await accountNames(page)).toEqual(["SBI証券", "銀行"]);

    await page.getByRole("button", { name: "内訳「米国株」を上へ移動" }).click();
    expect(await holdingMemos(page)).toEqual(["米国株", "オルカン", "普通預金"]);

    await page.getByRole("button", { name: /^保存/ }).click();
    const saved = await storedData(page);
    expect(saved.data.accounts.map((a: { id: string }) => a.id)).toEqual(["a2", "a1"]);
    expect(saved.data.accounts[0].holdings.map((h: { id: string }) => h.id)).toEqual(["h3", "h2"]);
    expect(saved.data.yearlyData[2026].monthlyAmounts[9]).toEqual({ h1: 100, h2: 200, h3: 300 });
    // 総資産は変わらない
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("¥600");
  });

  test("並び替えは「元に戻す」で取り消せる。キャンセルすると元の順に戻る", async ({ page }) => {
    await page.getByRole("button", { name: "口座「銀行」を下へ移動" }).click();
    expect(await accountNames(page)).toEqual(["SBI証券", "銀行"]);
    await page.getByRole("button", { name: "元に戻す" }).click();
    expect(await accountNames(page)).toEqual(["銀行", "SBI証券"]);

    await page.getByRole("button", { name: "内訳「オルカン」を下へ移動" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await page.getByRole("button", { name: "編集", exact: true }).click();
    expect(await holdingMemos(page)).toEqual(["普通預金", "オルカン", "米国株"]);
  });
});
