import { expect, test } from "@playwright/test";
import { goToYear, openApp, seedData } from "../helpers";

// 2024年1月〜2026年9月まで毎月入力済みのデータ
function multiYear() {
  const amounts: Record<string, Record<string, number>> = {};
  for (let y = 2024; y <= 2026; y++) {
    for (let m = 1; m <= (y === 2026 ? 9 : 12); m++) {
      const i = (y - 2024) * 12 + m;
      amounts[`${y}-${String(m).padStart(2, "0")}`] = { h1: 1_000_000 + i * 10_000, h2: 2_000_000 + i * 50_000, h3: 0 };
    }
  }
  return seedData(amounts);
}

const trendPanel = (page: import("@playwright/test").Page) =>
  page.locator("section", { has: page.getByRole("heading", { name: "資産推移" }) });
const allocationPanel = (page: import("@playwright/test").Page) =>
  page.locator("section", { has: page.getByRole("heading", { name: "ポートフォリオ構成比" }) });

test.describe("サマリーとグラフ", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, multiYear());
  });

  test("入力表の年を切り替えても、サマリー・推移・構成比は最新の値のまま", async ({ page }) => {
    const summary = page.getByRole("region", { name: "サマリー" });
    const before = await summary.innerText();
    const trendBefore = await trendPanel(page).locator("p").first().innerText();

    await goToYear(page, 2024);
    await expect(page.locator("span[aria-live='polite']").first()).toHaveText("2024年");
    expect(await summary.innerText()).toBe(before);
    expect(await trendPanel(page).locator("p").first().innerText()).toBe(trendBefore);
    await expect(allocationPanel(page)).toContainText("2026年9月末時点");

    await page.getByRole("button", { name: "今年へ" }).click();
    await expect(page.locator("span[aria-live='polite']").first()).toHaveText("2026年");
  });

  test("前月比・前年比・年初比が表示される", async ({ page }) => {
    const summary = page.getByRole("region", { name: "サマリー" });
    await expect(summary).toContainText("2026年8月末");
    await expect(summary).toContainText("2025年9月末");
    await expect(summary).toContainText("2025年12月末");
  });

  test("資産推移の期間切り替え（1年は今月までの直近12か月）", async ({ page }) => {
    const panel = trendPanel(page);
    await expect(panel).toContainText("2025年11月〜2026年10月");
    await panel.getByRole("button", { name: "2年" }).click();
    await expect(panel).toContainText("2024年11月〜2026年10月");
    await panel.getByRole("button", { name: "全期間" }).click();
    await expect(panel).toContainText("2024年1月〜2026年10月");
  });

  test("構成比の集計単位の切り替え", async ({ page }) => {
    const panel = allocationPanel(page);
    // 凡例（グラフのツールチップ内のリストは除く）
    const legend = panel.locator("ul:not(.recharts-tooltip-item-list)");
    await expect(legend).toContainText("投資信託");
    await panel.getByRole("button", { name: "地域" }).click();
    await expect(legend).toContainText("全世界");
    await panel.getByRole("button", { name: "口座" }).click();
    await expect(legend).toContainText("SBI証券");
  });

  test("拡大表示を開いて閉じる（× / Esc）", async ({ page }) => {
    await trendPanel(page).getByRole("button", { name: "拡大表示" }).click();
    const modal = page.getByRole("dialog", { name: "資産推移" });
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    await allocationPanel(page).getByRole("button", { name: "拡大表示" }).click();
    await page.getByRole("dialog", { name: "ポートフォリオ構成比" }).getByRole("button", { name: "閉じる" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("グラフを画像として保存できる", async ({ page, isMobile }) => {
    test.skip(isMobile, "スマホは共有シートを使うため PC のみ");
    const download = page.waitForEvent("download");
    await trendPanel(page).getByRole("button", { name: "画像として保存" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^tameru-資産推移-\d{8}-\d{6}\.png$/);
  });
});
