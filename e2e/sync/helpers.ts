import { expect, type Browser, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../helpers";

/**
 * ログイン・同期テスト用の道具。
 * Firebase エミュレーターの偽 Google ログイン画面を操作する（本番の Google・クラウドには接続しない）。
 */

/** テストの「今月」とその前月（サマリーの最新月になる月を作るため） */
export const now = new Date();
export const THIS_YEAR = now.getFullYear();
export const THIS_MONTH = now.getMonth() + 1;

/** テストごとに別のユーザーにする（エミュレーターのデータが混ざらないように） */
export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

export function dataWith(amounts: Record<string, Record<string, number>> = {}) {
  const yearlyData: Record<number, { year: number; monthlyAmounts: Record<number, Record<string, number>> }> = {};
  for (const [key, values] of Object.entries(amounts)) {
    const [y, m] = key.split("-").map(Number);
    yearlyData[y] ??= { year: y, monthlyAmounts: {} };
    yearlyData[y].monthlyAmounts[m] = values;
  }
  return {
    version: 3,
    data: {
      accounts: [
        { id: "a1", name: "銀行", holdings: [{ id: "h1", memo: "普通預金", assetClass: "cash", region: "japan" }] },
        { id: "a2", name: "SBI証券", holdings: [{ id: "h2", memo: "オルカン", assetClass: "fund", region: "global" }] },
      ],
      yearlyData,
    },
  };
}

/** 今月の金額データ（キー: "YYYY-MM"） */
export const thisMonthKey = `${THIS_YEAR}-${String(THIS_MONTH).padStart(2, "0")}`;

/** 新しい端末（ブラウザ）を用意し、保存データを入れた状態でアプリを開く */
export async function newDevice(browser: Browser, data: unknown | null) {
  const context = await browser.newContext({ locale: "ja-JP", timezoneId: "Asia/Tokyo" });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept()); // confirm には「OK」
  if (process.env.E2E_DEBUG) {
    page.on("console", (m) => console.log(`[browser:${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  }
  await page.goto("/manifest.webmanifest");
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      if (value) localStorage.setItem(key, value);
    },
    [STORAGE_KEY, data ? JSON.stringify(data) : null] as const,
  );
  await page.goto("/");
  await expect(page.getByRole("region", { name: "サマリー" })).toBeVisible();
  return page;
}

/** ヘッダーの同期状態ボタン */
export const syncButton = (page: Page) => page.locator("header button[aria-haspopup='menu']");

/** 「Google でログイン」→ 説明画面 → エミュレーターのログイン画面でログインする */
export async function login(page: Page, email: string) {
  // エミュレーターは起動直後の最初のログインだけ、結果がアプリに届かずログイン画面が閉じないことがある
  // （エミュレーター側の初期化の問題で、アプリの不具合ではない。main でも同じ）。その場合はログイン画面を閉じて最初からやり直す。
  // ログインが後から届いて「接続中」のまま止まった場合は、ページを開き直してからやり直す（loginOnce を参照）
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await loginOnce(page, email)) return;
    if (process.env.E2E_DEBUG) console.log(`[login] retry whole login (attempt ${attempt})`);
  }
  throw new Error("ログインできませんでした");
}

async function loginOnce(page: Page, email: string): Promise<boolean> {
  const t0 = Date.now();
  const log = (step: string) => process.env.E2E_DEBUG && console.log(`[login ${Date.now() - t0}ms] ${step}`);
  await page.getByRole("button", { name: /ログイン/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Google でログインして同期" });
  const loginButton = dialog.getByRole("button", { name: /Google でログイン/ });
  await expect(loginButton).toBeEnabled({ timeout: 20_000 }); // ログインの準備（Firebase の読み込み）が終わるまで待つ
  log("intro ready");
  const popupPromise = page.waitForEvent("popup");
  await loginButton.click();
  const popup = await popupPromise;
  log(`popup opened ${popup.url().slice(0, 60)}`);
  // エミュレーターのログイン画面の読み込みが終わるまで待つ（初回は遅く、途中で入力すると消えてしまうため）
  await popup.waitForLoadState("networkidle");
  await popup.getByText("Add new account").waitFor();
  // すでに作成済みのアカウントなら一覧から選び、なければ新規作成する
  const existing = popup.getByText(email);
  if (await existing.isVisible()) {
    await existing.click();
  } else {
    await popup.getByText("Add new account").click();
    await popup.locator("#email-input").fill(email);
    await popup.getByRole("button", { name: "Sign in with Google.com" }).click();
  }
  log("account chosen");
  const closed = popup.isClosed() || (await popup.waitForEvent("close", { timeout: 8_000 }).then(() => true, () => false));
  if (!closed) {
    log("popup did not close; closing and retrying");
    await popup.close();
    await expect(dialog).toBeHidden({ timeout: 10_000 }); // アプリ側は「ログイン画面を閉じた」として説明画面を閉じる
    // ログインが後から届いた場合は、「Google でログイン」ボタンの代わりに同期の状態（「接続中」など）が表示される
    await page.waitForTimeout(2_000);
    if (await syncButton(page).isVisible()) {
      // この状態では同期が始まらないため、ページを開き直す（後から届いたログインは保存されず、未ログインに戻る）
      log("signed in late; reloading");
      await page.reload();
      await expect(page.getByRole("region", { name: "サマリー" })).toBeVisible();
      await page.waitForTimeout(2_000);
      if (await syncButton(page).isVisible()) return true; // ログインが保存されていた場合は、そのまま同期が始まる
    }
    return false;
  }
  log("popup closed");
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  log("intro closed");
  return true;
}

/** 同期が終わるまで待つ（ヘッダーが「ログイン済み」になる） */
export async function waitSynced(page: Page) {
  await expect(syncButton(page)).toContainText("ログイン済み", { timeout: 15_000 });
}

/** 同期メニューを開く */
export async function openSyncMenu(page: Page) {
  await syncButton(page).click();
  return page.getByRole("menu");
}

/** 記録の画面で 編集 → 金額を入力 → 保存 → ホームの画面に戻る */
export async function editAndSave(page: Page, holdingId: string, year: number, month: number, value: string) {
  await page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("link", { name: "記録", exact: true }).click();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await goToTableYear(page, year);
  await page.locator(`input[data-cell="${holdingId}:${month}"]`).fill(value);
  await page.getByRole("button", { name: /^保存/ }).click();
  await expect(page.getByRole("button", { name: "編集", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(page.getByRole("region", { name: "サマリー" })).toBeVisible();
}

async function goToTableYear(page: Page, year: number) {
  const label = page.locator("span[aria-live='polite']").first();
  for (let i = 0; i < 10; i++) {
    const current = Number((await label.innerText()).replace("年", ""));
    if (current === year) return;
    await page.getByRole("button", { name: current > year ? "前の年" : "次の年" }).click();
  }
}

/** この端末に保存されている金額 */
export async function storedAmount(page: Page, holdingId: string, year: number, month: number) {
  return page.evaluate(
    ([key, y, m, h]) => JSON.parse(localStorage.getItem(key as string) ?? "null")?.data?.yearlyData?.[y]?.monthlyAmounts?.[m]?.[h],
    [STORAGE_KEY, year, month, holdingId] as const,
  );
}
