import { describe, expect, it } from "vitest";
import { applyEditAction, fillEmptyWithZero } from "@/lib/storeReducer";
import { MAX_ACCOUNTS, MAX_HOLDINGS_PER_ACCOUNT } from "@/lib/constants";
import { account, holding, sampleAccounts, store } from "./helpers";

describe("口座・内訳の追加と削除", () => {
  it("口座は最大6件まで", () => {
    let s = store([]);
    for (let i = 0; i < MAX_ACCOUNTS + 2; i++) {
      s = applyEditAction(s, { type: "addAccount", account: account(`a${i}`, "", [holding(`h${i}`)]) });
    }
    expect(s.accounts).toHaveLength(MAX_ACCOUNTS);
  });

  it("内訳は1口座あたり最大10件まで", () => {
    let s = store([account("a1", "", [])]);
    for (let i = 0; i < MAX_HOLDINGS_PER_ACCOUNT + 2; i++) {
      s = applyEditAction(s, { type: "addHolding", accountId: "a1", holding: holding(`h${i}`) });
    }
    expect(s.accounts[0].holdings).toHaveLength(MAX_HOLDINGS_PER_ACCOUNT);
  });

  it("口座を削除すると、その内訳の金額も全期間から消える", () => {
    const s = store(sampleAccounts(), { "2025-12": { h1: 1, h2: 2 }, "2026-01": { h2: 3, h3: 4 } });
    const next = applyEditAction(s, { type: "removeAccount", accountId: "a2" });
    expect(next.accounts.map((a) => a.id)).toEqual(["a1"]);
    expect(next.yearlyData[2025].monthlyAmounts[12]).toEqual({ h1: 1 });
    // 中身がなくなった月・年はキーごと消える
    expect(next.yearlyData[2026]).toBeUndefined();
  });

  it("内訳を削除すると、その金額だけ消える", () => {
    const s = store(sampleAccounts(), { "2026-01": { h2: 3, h3: 4 } });
    const next = applyEditAction(s, { type: "removeHolding", holdingId: "h3" });
    expect(next.accounts[1].holdings.map((h) => h.id)).toEqual(["h2"]);
    expect(next.yearlyData[2026].monthlyAmounts[1]).toEqual({ h2: 3 });
  });
});

describe("内訳の変更", () => {
  it("資産クラスを現金にすると地域は日本、ゴールドにすると地域なしに自動で揃う", () => {
    const s = store([account("a1", "", [holding("h1", "other", "none")])]);
    const cash = applyEditAction(s, { type: "updateHolding", holdingId: "h1", patch: { assetClass: "cash" } });
    expect(cash.accounts[0].holdings[0].region).toBe("japan");
    const gold = applyEditAction(cash, { type: "updateHolding", holdingId: "h1", patch: { assetClass: "gold" } });
    expect(gold.accounts[0].holdings[0].region).toBe("none");
  });

  it("地域を直接指定したときは、その値を使う", () => {
    const s = store([account("a1", "", [holding("h1", "other", "none")])]);
    const next = applyEditAction(s, {
      type: "updateHolding",
      holdingId: "h1",
      patch: { assetClass: "cash", region: "us" },
    });
    expect(next.accounts[0].holdings[0].region).toBe("us");
  });
});

describe("金額の入力", () => {
  it("入力・上書き・空欄に戻す", () => {
    let s = store(sampleAccounts());
    s = applyEditAction(s, { type: "setAmount", year: 2026, month: 1, holdingId: "h1", value: 100 });
    s = applyEditAction(s, { type: "setAmount", year: 2026, month: 1, holdingId: "h1", value: 200 });
    expect(s.yearlyData[2026].monthlyAmounts[1]).toEqual({ h1: 200 });
    s = applyEditAction(s, { type: "setAmount", year: 2026, month: 1, holdingId: "h1", value: null });
    expect(s.yearlyData[2026]).toBeUndefined();
  });

  it("同じ値なら何も変えない（データを作り直さない）", () => {
    const s = store(sampleAccounts(), { "2026-01": { h1: 100 } });
    expect(applyEditAction(s, { type: "setAmount", year: 2026, month: 1, holdingId: "h1", value: 100 })).toBe(s);
  });
});

describe("前月コピー", () => {
  it("前月の値をそのまま複製する（既存の値は置き換える）", () => {
    const s = store(sampleAccounts(), { "2026-02": { h1: 10, h2: 20 }, "2026-03": { h3: 99 } });
    const next = applyEditAction(s, { type: "copyPreviousMonth", year: 2026, month: 3 });
    expect(next.yearlyData[2026].monthlyAmounts[3]).toEqual({ h1: 10, h2: 20 });
  });

  it("1月は前年12月からコピーする", () => {
    const s = store(sampleAccounts(), { "2025-12": { h1: 5 } });
    const next = applyEditAction(s, { type: "copyPreviousMonth", year: 2026, month: 1 });
    expect(next.yearlyData[2026].monthlyAmounts[1]).toEqual({ h1: 5 });
  });
});

describe("fillEmptyWithZero（保存時の0埋め）", () => {
  it("入力がある月の空欄だけを0で埋め、入力のない月（未来の月など）は空欄のまま", () => {
    const s = store(sampleAccounts(), { "2026-09": { h1: 100 }, "2026-10": { h2: 50 } });
    const next = fillEmptyWithZero(s);
    expect(next.yearlyData[2026].monthlyAmounts[9]).toEqual({ h1: 100, h2: 0, h3: 0 });
    expect(next.yearlyData[2026].monthlyAmounts[10]).toEqual({ h1: 0, h2: 50, h3: 0 });
    expect(next.yearlyData[2026].monthlyAmounts[11]).toBeUndefined();
  });

  it("あとから追加した内訳は、過去の入力済みの月で0になる（全期間が対象）", () => {
    const s = store(sampleAccounts(), { "2024-05": { h1: 1, h2: 2, h3: 3 } });
    const added = applyEditAction(s, { type: "addHolding", accountId: "a1", holding: holding("h4") });
    expect(fillEmptyWithZero(added).yearlyData[2024].monthlyAmounts[5].h4).toBe(0);
  });

  it("すでにすべて入力済みならデータを作り直さない", () => {
    const s = store(sampleAccounts(), { "2026-01": { h1: 1, h2: 2, h3: 3 } });
    expect(fillEmptyWithZero(s)).toBe(s);
  });
});
