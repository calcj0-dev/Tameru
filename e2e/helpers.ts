import { expect, type Page } from "@playwright/test";

export const STORAGE_KEY = "tameru:store";

type Amounts = Record<string, Record<string, number>>;

/** テスト用の保存データ（v3 形式）。amounts は { "2026-01": { h1: 100 } } のように指定 */
export function seedData(amounts: Amounts = {}) {
  const yearlyData: Record<number, { year: number; monthlyAmounts: Record<number, Record<string, number>> }> = {};
  for (const [key, values] of Object.entries(amounts)) {
    const [y, m] = key.split("-").map(Number);
    yearlyData[y] ??= { year: y, monthlyAmounts: {} };
    yearlyData[y].monthlyAmounts[m] = values;
  }
  return {
    version: 3,
    savedAt: new Date().toISOString(),
    data: {
      accounts: [
        { id: "a1", name: "銀行", holdings: [{ id: "h1", memo: "普通預金", assetClass: "cash", region: "japan" }] },
        {
          id: "a2",
          name: "SBI証券",
          holdings: [
            { id: "h2", memo: "オルカン", assetClass: "fund", region: "global" },
            { id: "h3", memo: "米国株", assetClass: "stock", region: "us" },
          ],
        },
      ],
      yearlyData,
    },
  };
}

/** テストの「今日」。日付によって結果が変わらないよう固定する */
export const TODAY = new Date("2026-10-15T10:00:00+09:00");

/**
 * 保存データを入れた状態でアプリを開く（null なら空の状態＝初回起動）。
 * 初回の紹介カードは、welcome: true のときだけ表示する（ほかのテストの邪魔にならないように）
 */
export async function openApp(page: Page, data: unknown | null = seedData(), { welcome = false } = {}) {
  await page.clock.setFixedTime(TODAY);
  // アプリが起動すると初期データを保存してしまうため、アプリを読み込まないページ（同じドメイン）で先にデータを入れる
  await page.goto("/manifest.webmanifest");
  await page.evaluate(
    ([key, value, showWelcome]) => {
      localStorage.clear();
      if (value) localStorage.setItem(key, value);
      if (!showWelcome) localStorage.setItem("tameru:welcome-dismissed", "1");
    },
    [STORAGE_KEY, data ? JSON.stringify(data) : null, welcome] as const,
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "資産入力" })).toBeVisible();
}

/** LocalStorage に保存されているデータ */
export async function storedData(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), STORAGE_KEY);
}

/** 保存されている、ある年月の金額 */
export async function storedMonth(page: Page, year: number, month: number) {
  const s = await storedData(page);
  return s?.data?.yearlyData?.[year]?.monthlyAmounts?.[month] ?? null;
}

/** 金額セル（編集中のみ） */
export function cell(page: Page, holdingId: string, month: number) {
  return page.locator(`input[data-cell="${holdingId}:${month}"]`);
}

export const summary = (page: Page) => page.getByRole("region", { name: "サマリー" }).or(page.locator("section[aria-label='サマリー']"));

/** 入力表の年を指定の年に合わせる */
export async function goToYear(page: Page, year: number) {
  const label = page.locator("span[aria-live='polite']").first();
  for (let i = 0; i < 20; i++) {
    const current = Number((await label.innerText()).replace("年", ""));
    if (current === year) return;
    await page.getByRole("button", { name: current > year ? "前の年" : "次の年" }).click();
  }
}

/** confirm ダイアログに自動で答える */
export function answerDialogs(page: Page, accept: boolean) {
  const messages: string[] = [];
  page.on("dialog", async (d) => {
    messages.push(d.message());
    await (accept ? d.accept() : d.dismiss());
  });
  return messages;
}
