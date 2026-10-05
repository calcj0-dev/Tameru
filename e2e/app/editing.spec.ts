import { expect, test, type Page } from "@playwright/test";
import { answerDialogs, cell, goToYear, openApp, seedData, storedData, storedMonth } from "../helpers";

const editButton = (page: Page) => page.getByRole("button", { name: "編集", exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: /^保存/ });
const cancelButton = (page: Page) => page.getByRole("button", { name: "キャンセル", exact: true });

test.describe("編集と保存", () => {
  test("編集 → 入力 → 保存で反映され、参照のみに戻る。保存するまでサマリーは変わらない", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 1_000_000, h2: 2_000_000, h3: 0 } }));
    await editButton(page).click();
    await expect(saveButton(page)).toBeEnabled(); // 変更がなくても押せる（入力直後に押しても1回で保存できるように）

    await cell(page, "h1", 10).fill("1500000");
    await cell(page, "h1", 10).blur();
    // 保存前: サマリーは9月のまま
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("2026年9月末時点");

    await saveButton(page).click();
    await expect(page.locator("input[data-cell]")).toHaveCount(0); // 参照のみに戻る
    await expect(page.getByRole("region", { name: "サマリー" })).toContainText("2026年10月末時点");
    // 入力がある月の空欄は0で埋まる（未来の月は空欄のまま）
    expect(await storedMonth(page, 2026, 10)).toEqual({ h1: 1_500_000, h2: 0, h3: 0 });
    expect(await storedMonth(page, 2026, 11)).toBeNull();
  });

  test("入力した直後に保存ボタンを押しても、入力した値が保存される", async ({ page }) => {
    await openApp(page, seedData());
    await editButton(page).click();
    await cell(page, "h2", 1).fill("777");
    await saveButton(page).click(); // blur せずにそのまま押す
    expect((await storedMonth(page, 2026, 1))?.h2).toBe(777);
  });

  test("0は薄いグレーで表示される", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 1000, h2: 0, h3: 0 } }));
    const zero = page.locator("tbody td span", { hasText: /^0$/ }).first();
    const color = await zero.evaluate((el) => getComputedStyle(el).color);
    const normal = await page.locator("tbody td span", { hasText: "1,000" }).first().evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe(normal);
  });

  test("キャンセル: 変更がなければ確認なしで戻り、変更があれば確認が出る", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 1000 } }));
    const dialogs = answerDialogs(page, false);

    await editButton(page).click();
    await cancelButton(page).click();
    expect(dialogs).toHaveLength(0);
    await expect(editButton(page)).toBeVisible();

    await editButton(page).click();
    await cell(page, "h1", 9).fill("5");
    await cancelButton(page).click(); // 確認で「キャンセル」→ 編集を続ける
    expect(dialogs.at(-1)).toContain("変更を破棄しますか");
    await expect(saveButton(page)).toBeVisible();

    page.removeAllListeners("dialog");
    answerDialogs(page, true);
    await cancelButton(page).click(); // 確認で「OK」→ 破棄
    await expect(editButton(page)).toBeVisible();
    expect((await storedMonth(page, 2026, 9))?.h1).toBe(1000);
  });

  test("変更がないまま保存すると、何も変えずに参照のみに戻る", async ({ page }) => {
    await openApp(page, seedData({ "2026-09": { h1: 1000 } }));
    const before = await storedData(page);
    await editButton(page).click();
    await saveButton(page).click();
    await expect(editButton(page)).toBeVisible();
    expect((await storedData(page)).data).toEqual(before.data);
  });

  test("再読み込みすると参照のみから始まる", async ({ page }) => {
    await openApp(page, seedData());
    await editButton(page).click();
    await page.reload();
    await expect(editButton(page)).toBeVisible();
    await expect(page.locator("input[data-cell]")).toHaveCount(0);
  });
});

test.describe("元に戻す・やり直す", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, seedData({ "2026-01": { h1: 100 } }));
    await editButton(page).click();
  });

  const undoButton = (page: Page) => page.getByRole("button", { name: "元に戻す" });
  const redoButton = (page: Page) => page.getByRole("button", { name: "やり直す" });

  test("ボタンで1つずつ戻せて、やり直せる。同じセルへの入力は1回で戻る", async ({ page }) => {
    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();

    await cell(page, "h1", 1).click();
    await page.keyboard.type("1500000"); // 1文字ずつ入力しても1回の操作
    await cell(page, "h2", 1).click();
    await page.keyboard.type("300");

    await undoButton(page).click();
    await expect(cell(page, "h2", 1)).toHaveValue("");
    await expect(cell(page, "h1", 1)).toHaveValue("1,500,000");
    await undoButton(page).click();
    await expect(cell(page, "h1", 1)).toHaveValue("100");
    await expect(undoButton(page)).toBeDisabled();

    await redoButton(page).click();
    await expect(cell(page, "h1", 1)).toHaveValue("1,500,000");
  });

  test("口座の削除も元に戻せる", async ({ page }) => {
    answerDialogs(page, true);
    await page.getByRole("button", { name: "口座「SBI証券」を削除" }).click();
    await expect(page.getByRole("textbox", { name: "口座名 2" })).toHaveCount(0);
    await undoButton(page).click();
    await expect(page.getByRole("textbox", { name: "口座名 2" })).toHaveValue("SBI証券");
  });

  test("全部戻すと「変更なし」になり、キャンセルで確認が出ない", async ({ page }) => {
    const dialogs = answerDialogs(page, false);
    await cell(page, "h1", 1).fill("999");
    await undoButton(page).click();
    await cancelButton(page).click();
    expect(dialogs).toHaveLength(0);
    await expect(editButton(page)).toBeVisible();
  });

  test("Ctrl+Z で戻し、Ctrl+Y / Ctrl+Shift+Z でやり直せる（入力中でも表全体の操作になる）", async ({ page, isMobile }) => {
    test.skip(isMobile, "キーボード操作は PC のみ");
    await cell(page, "h1", 1).click();
    await page.keyboard.type("777");
    await page.keyboard.press("Control+z"); // 入力欄にフォーカスがあるまま
    await expect(cell(page, "h1", 1)).toHaveValue("100");
    await page.keyboard.press("Control+y");
    await expect(cell(page, "h1", 1)).toHaveValue("777");
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");
    await expect(cell(page, "h1", 1)).toHaveValue("777");
  });

  test("戻した状態で保存すると、戻した内容が保存される", async ({ page }) => {
    await cell(page, "h1", 1).fill("200");
    await cell(page, "h2", 1).fill("300");
    await undoButton(page).click();
    await saveButton(page).click();
    expect(await storedMonth(page, 2026, 1)).toEqual({ h1: 200, h2: 0, h3: 0 });
  });
});

test.describe("金額の入力", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, seedData({ "2026-01": { h1: 100 } }));
    await editButton(page).click();
  });

  test("全角数字・カンマ・円記号を含む入力を解釈し、カンマ区切りで表示する", async ({ page }) => {
    const c = cell(page, "h2", 1);
    await c.fill("１，２３４円");
    await c.blur();
    await expect(c).toHaveValue("1,234");
  });

  test("フォーカスすると生の数値が全選択され、そのまま上書きできる", async ({ page }) => {
    const c = cell(page, "h1", 1);
    await c.click();
    await expect(c).toHaveValue("100");
    await page.keyboard.type("250");
    await c.blur();
    await expect(c).toHaveValue("250");
  });

  test("解釈できない入力は元の値に戻り、Esc で編集を取り消せる", async ({ page }) => {
    const c = cell(page, "h1", 1);
    await c.fill("abc");
    await c.blur();
    await expect(c).toHaveValue("100");
    await c.click();
    await page.keyboard.type("999");
    await page.keyboard.press("Escape");
    await expect(c).toHaveValue("100");
  });

  test("Enter で下へ（最終行なら次の月の先頭へ）、Tab で右へ移動する", async ({ page, isMobile }) => {
    test.skip(isMobile, "キーボード操作は PC のみ");
    await cell(page, "h1", 1).click();
    await page.keyboard.press("Enter");
    await expect(cell(page, "h2", 1)).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(cell(page, "h1", 2)).toBeFocused(); // h3 の次は2月の先頭
    await page.keyboard.press("Tab");
    await expect(cell(page, "h1", 3)).toBeFocused();
    await page.keyboard.press("Shift+Enter");
    await expect(cell(page, "h3", 2)).toBeFocused();
  });
});

test.describe("口座・内訳の管理", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, seedData({ "2026-01": { h1: 1, h2: 2, h3: 3 } }));
    await editButton(page).click();
  });

  test("口座を追加して名前を付け、内訳を追加・設定して保存する", async ({ page }) => {
    await page.getByRole("button", { name: /口座を追加/ }).click();
    await expect(page.getByRole("textbox", { name: "口座名 3" })).toBeFocused();
    await page.keyboard.type("楽天証券");

    await page.locator("button[title='内訳を追加']").nth(2).click();
    const memos = page.getByRole("textbox", { name: "楽天証券の内訳メモ" });
    await expect(memos).toHaveCount(2);
    await memos.nth(1).fill("ゴールドETF");
    // 資産クラスをゴールドにすると地域は「なし」に自動で揃う
    const row = memos.nth(1).locator("xpath=ancestor::tr");
    await row.getByRole("combobox", { name: "資産クラス" }).selectOption("gold");
    await expect(row.getByRole("combobox", { name: "地域" })).toHaveValue("none");

    await saveButton(page).click();
    const stored = await storedData(page);
    const rakuten = stored.data.accounts.find((a: { name: string }) => a.name === "楽天証券");
    expect(rakuten.holdings).toHaveLength(2);
    expect(rakuten.holdings[1]).toMatchObject({ memo: "ゴールドETF", assetClass: "gold", region: "none" });
  });

  test("データのある口座を削除するときは確認が出る", async ({ page }) => {
    const dialogs = answerDialogs(page, true);
    await page.getByRole("button", { name: "口座「SBI証券」を削除" }).click();
    expect(dialogs.at(-1)).toContain("SBI証券");
    await saveButton(page).click();
    const stored = await storedData(page);
    expect(stored.data.accounts.map((a: { name: string }) => a.name)).toEqual(["銀行"]);
    expect(await storedMonth(page, 2026, 1)).toEqual({ h1: 1 });
  });

  test("口座は6件まで追加できる", async ({ page }) => {
    const add = page.getByRole("button", { name: /口座を追加/ });
    for (let i = 0; i < 4; i++) await add.click();
    await expect(add).toBeDisabled();
    await expect(add).toContainText("6/6");
  });

  test("前月コピーで前月の値を複製できる（1月は前年12月から）", async ({ page }) => {
    await page.getByRole("button", { name: "前月コピー" }).nth(1).click(); // 2月
    await expect(cell(page, "h3", 2)).toHaveValue("3");
    await saveButton(page).click();
    expect(await storedMonth(page, 2026, 2)).toEqual({ h1: 1, h2: 2, h3: 3 });

    await editButton(page).click();
    await goToYear(page, 2027);
    await expect(page.getByRole("button", { name: "前月コピー" }).first()).toBeDisabled(); // 2026年12月は未入力
  });
});

test.describe("表示の不具合の再発防止", () => {
  test("横スクロールしても、口座/内訳の列に金額が透けない（固定列の背景が不透明）", async ({ page, isMobile }) => {
    test.skip(isMobile, "マウスを乗せたときの表示のため PC のみ");
    await openApp(page, seedData({ "2026-01": { h1: 1_234_567 } }));
    await editButton(page).click();
    const row = page.locator("tbody tr", { has: page.getByRole("textbox", { name: "銀行の内訳メモ" }) });
    await row.hover();
    const bg = await row.locator("th").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toMatch(/\/\s*0?\.\d+\)|rgba\(.*,\s*0?\.\d+\)/); // 半透明でない
  });
});
