import { expect, test } from "@playwright/test";
import {
  dataWith,
  editAndSave,
  login,
  newDevice,
  openSyncMenu,
  storedAmount,
  syncButton,
  THIS_MONTH,
  THIS_YEAR,
  thisMonthKey,
  uniqueEmail,
  waitSynced,
} from "./helpers";

/**
 * ログイン・同期のシナリオテスト（Firebase エミュレーター使用）。
 * 端末A（PC役）と端末B（スマホ役）を別々のブラウザとして動かす。
 */

test("ログインすると、この端末のデータがクラウドに保存され、別の端末に引き継がれる", async ({ browser }) => {
  const email = uniqueEmail("first");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 1_000_000, h2: 2_000_000 } }));
  await login(a, email);
  await waitSynced(a);

  // 端末B（データなし）でログイン → 選択画面なしでクラウドのデータを取り込む
  const b = await newDevice(browser, null);
  await login(b, email);
  await waitSynced(b);
  await expect(b.getByRole("dialog")).toBeHidden();
  await expect(b.getByRole("region", { name: "サマリー" })).toContainText("¥3,000,000");
});

test("片方の端末で保存すると、もう片方にリアルタイムで反映される（双方向）", async ({ browser }) => {
  const email = uniqueEmail("realtime");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 100, h2: 200 } }));
  await login(a, email);
  await waitSynced(a);
  const b = await newDevice(browser, null);
  await login(b, email);
  await waitSynced(b);

  await editAndSave(a, "h1", THIS_YEAR, THIS_MONTH, "500");
  await expect.poll(() => storedAmount(b, "h1", THIS_YEAR, THIS_MONTH), { timeout: 15_000 }).toBe(500);
  await expect(b.getByRole("region", { name: "サマリー" })).toContainText("¥700");

  await editAndSave(b, "h2", THIS_YEAR, THIS_MONTH, "900");
  await expect.poll(() => storedAmount(a, "h2", THIS_YEAR, THIS_MONTH), { timeout: 15_000 }).toBe(900);
});

test("両方の端末にデータがある場合: 比較して選べる。「クラウド」を選ぶとバックアップされ、元に戻せる", async ({ browser }) => {
  const email = uniqueEmail("choice-cloud");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 5_100_000 } }));
  await login(a, email);
  await waitSynced(a);

  const b = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 3_480_000 } }));
  await login(b, email);
  const dialog = b.getByRole("dialog", { name: "どちらのデータを使いますか？" });
  await expect(dialog).toContainText("¥5,100,000"); // クラウド
  await expect(dialog).toContainText("¥3,480,000"); // この端末
  await dialog.getByRole("button", { name: /クラウドのデータを使う/ }).click();
  await waitSynced(b);
  await expect(b.getByRole("region", { name: "サマリー" })).toContainText("¥5,100,000");

  // 置き換えた直後の案内 → 元に戻す（confirm は自動で OK）
  await expect(b.getByText("この端末のデータを、クラウドのデータに置き換えました。")).toBeVisible();
  await b.getByRole("button", { name: "元に戻す" }).click();
  await expect(b.getByRole("region", { name: "サマリー" })).toContainText("¥3,480,000");
  // 戻したデータは同期され、端末Aにも届く
  await expect.poll(() => storedAmount(a, "h1", THIS_YEAR, THIS_MONTH), { timeout: 15_000 }).toBe(3_480_000);
});

test("「この端末のデータを使う」は2回目の確認があり、上書き前のクラウドのデータはバックアップされる", async ({ browser }) => {
  const email = uniqueEmail("choice-device");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 111 } }));
  await login(a, email);
  await waitSynced(a);

  const b = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 222 } }));
  await login(b, email);
  await b.getByRole("button", { name: /この端末のデータを使う/ }).click();
  const confirm = b.getByRole("dialog", { name: "クラウドのデータを上書きしますか？" });
  await expect(confirm).toBeVisible();
  // 一度「戻る」で選択画面に戻れる
  await confirm.getByRole("button", { name: "戻る" }).click();
  await b.getByRole("button", { name: /この端末のデータを使う/ }).click();
  await b.getByRole("button", { name: "上書きする" }).click();
  await waitSynced(b);

  // 端末A（クラウド側）が端末Bの内容になる
  await expect.poll(() => storedAmount(a, "h1", THIS_YEAR, THIS_MONTH), { timeout: 15_000 }).toBe(222);
  // 端末Bには上書き前のクラウドのデータ（111）がバックアップされている
  const menu = await openSyncMenu(b);
  await expect(menu).toContainText("バックアップから戻す");
  await expect(menu).toContainText("上書きする前の、クラウドのデータ");
});

test("ログアウト（データを残す）→ ログアウト中に入力 → 再ログインすると、選択画面なしで続きから同期する", async ({ browser }) => {
  const email = uniqueEmail("relogin");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 100 } }));
  await login(a, email);
  await waitSynced(a);
  const b = await newDevice(browser, null);
  await login(b, email);
  await waitSynced(b);

  // 端末Aでログアウト（データを残す）
  const menu = await openSyncMenu(a);
  await menu.getByRole("menuitem", { name: /ログアウト/ }).click();
  await a.getByRole("button", { name: /この端末のデータを残してログアウト/ }).click();
  await expect(a.getByRole("button", { name: /ログイン/ }).first()).toBeVisible();
  expect(await storedAmount(a, "h1", THIS_YEAR, THIS_MONTH)).toBe(100); // データは残る

  // ログアウト中に入力
  await editAndSave(a, "h2", THIS_YEAR, THIS_MONTH, "4444");

  // 再ログイン → 選択画面は出ず、ログアウト中の入力が他の端末に届く
  await login(a, email);
  await waitSynced(a);
  await expect(a.getByRole("dialog", { name: "どちらのデータを使いますか？" })).toBeHidden();
  await expect.poll(() => storedAmount(b, "h2", THIS_YEAR, THIS_MONTH), { timeout: 15_000 }).toBe(4444);
});

test("ログアウト（この端末のデータも削除）→ この端末からは消え、クラウドには残る", async ({ browser }) => {
  const email = uniqueEmail("logout-clear");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 777 } }));
  await login(a, email);
  await waitSynced(a);

  const menu = await openSyncMenu(a);
  await menu.getByRole("menuitem", { name: /ログアウト/ }).click();
  await a.getByRole("button", { name: /この端末のデータも削除してログアウト/ }).click();
  await expect(a.getByRole("button", { name: /ログイン/ }).first()).toBeVisible();
  await expect(a.getByRole("region", { name: "サマリー" })).toContainText("まだデータが入力されていません");

  // もう一度ログインすれば、クラウドから戻ってくる
  await login(a, email);
  await waitSynced(a);
  await expect(a.getByRole("region", { name: "サマリー" })).toContainText("¥777");
});

test("同期をやめて、クラウドのデータを削除: 「削除」と入力するまで実行できず、実行するとクラウドが空になる", async ({ browser }) => {
  const email = uniqueEmail("delete");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 888 } }));
  await login(a, email);
  await waitSynced(a);

  const menu = await openSyncMenu(a);
  await expect(menu).toContainText("Google アカウントは削除されません");
  await menu.getByRole("menuitem", { name: /同期をやめて、クラウドのデータを削除/ }).click();
  const dialog = a.getByRole("dialog", { name: "同期をやめて、クラウドのデータを削除" });
  const run = dialog.getByRole("button", { name: "クラウドのデータを削除" });
  await expect(run).toBeDisabled();
  await dialog.getByRole("textbox").fill("削除");
  await run.click();
  await expect(a.getByRole("button", { name: /ログイン/ }).first()).toBeVisible();
  expect(await storedAmount(a, "h1", THIS_YEAR, THIS_MONTH)).toBe(888); // この端末のデータは残る

  // 別の端末で同じアカウントにログインしても、クラウドのデータはない（新規扱い）
  const b = await newDevice(browser, null);
  await login(b, email);
  await waitSynced(b);
  await expect(b.getByRole("region", { name: "サマリー" })).toContainText("まだデータが入力されていません");
});

test("新しい形式のデータがクラウドにあると、古いアプリは同期を止めて上書きしない", async ({ browser }) => {
  const email = uniqueEmail("outdated");
  const a = await newDevice(browser, dataWith({ [thisMonthKey]: { h1: 1 } }));
  await login(a, email);
  await waitSynced(a);

  // 「新しいバージョンのアプリが保存した」データをクラウドに置く（エミュレーターのデータベースに管理者として直接書き込む）
  const meta = await a.evaluate(() => JSON.parse(localStorage.getItem("tameru:sync") ?? "{}"));
  const url = `http://127.0.0.1:8080/v1/projects/tameru-dde4e/databases/(default)/documents/users/${meta.uid}`;
  const headers = { Authorization: "Bearer owner", "Content-Type": "application/json" };
  const current = await (await fetch(url, { headers })).json();
  const rev = Number(current.fields.rev.integerValue);
  const res = await fetch(`${url}?updateMask.fieldPaths=schemaVersion&updateMask.fieldPaths=rev`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields: { schemaVersion: { integerValue: "99" }, rev: { integerValue: String(rev + 1) } } }),
  });
  expect(res.ok).toBe(true);

  await expect(syncButton(a)).toContainText("更新が必要", { timeout: 15_000 });
  await editAndSave(a, "h1", THIS_YEAR, THIS_MONTH, "2");
  // 同期が止まっているので「更新が必要」のまま（クラウドを上書きしない）
  await expect(syncButton(a)).toContainText("更新が必要");
});
