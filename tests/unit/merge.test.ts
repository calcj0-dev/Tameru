import { describe, expect, it } from "vitest";
import type { TameruStore } from "@/types/asset";
import { hasNoAmounts, mergeStores, stableStringify } from "@/lib/sync/merge";
import { account, holding, sampleAccounts, store } from "./helpers";

const base: TameruStore = store(sampleAccounts(), { "2026-01": { h1: 100, h2: 200, h3: 300 } });
const clone = (s: TameruStore): TameruStore => structuredClone(s);

describe("mergeStores（同期の3者マージ）", () => {
  it("変更がなければそのまま", () => {
    expect(stableStringify(mergeStores(base, clone(base), clone(base)))).toBe(stableStringify(base));
  });

  it("別々のセルを変更 → 両方の変更が残る", () => {
    const local = clone(base);
    local.yearlyData[2026].monthlyAmounts[1].h1 = 111;
    const remote = clone(base);
    remote.yearlyData[2026].monthlyAmounts[1].h2 = 222;
    expect(mergeStores(base, local, remote).yearlyData[2026].monthlyAmounts[1]).toEqual({ h1: 111, h2: 222, h3: 300 });
  });

  it("同じセルを両方で変更 → この端末（local）を優先", () => {
    const local = clone(base);
    local.yearlyData[2026].monthlyAmounts[1].h1 = 111;
    const remote = clone(base);
    remote.yearlyData[2026].monthlyAmounts[1].h1 = 999;
    expect(mergeStores(base, local, remote).yearlyData[2026].monthlyAmounts[1].h1).toBe(111);
  });

  it("別々の月を追加 → 両方残る", () => {
    const local = clone(base);
    local.yearlyData[2026].monthlyAmounts[2] = { h1: 150 };
    const remote = clone(base);
    remote.yearlyData[2026].monthlyAmounts[3] = { h2: 250 };
    expect(Object.keys(mergeStores(base, local, remote).yearlyData[2026].monthlyAmounts)).toEqual(["1", "2", "3"]);
  });

  it("空欄に戻した変更も反映される", () => {
    const local = clone(base);
    delete local.yearlyData[2026].monthlyAmounts[1].h3;
    expect(mergeStores(base, local, clone(base)).yearlyData[2026].monthlyAmounts[1].h3).toBeUndefined();
  });

  it("両方で別々に口座を追加 → 両方残る（クラウドの順 ＋ この端末の追加分）", () => {
    const local = clone(base);
    local.accounts.push(account("a3", "楽天", [holding("h4")]));
    const remote = clone(base);
    remote.accounts.push(account("a4", "現金", [holding("h5", "cash", "japan")]));
    expect(mergeStores(base, local, remote).accounts.map((a) => a.id)).toEqual(["a1", "a2", "a4", "a3"]);
  });

  it("片方で内訳を削除 → 削除され、その金額も消える（もう片方で金額を変えていても）", () => {
    const remote = clone(base);
    remote.accounts[1].holdings = remote.accounts[1].holdings.filter((h) => h.id !== "h3");
    delete remote.yearlyData[2026].monthlyAmounts[1].h3;
    const local = clone(base);
    local.yearlyData[2026].monthlyAmounts[1].h3 = 333;
    const merged = mergeStores(base, local, remote);
    expect(merged.accounts[1].holdings).toHaveLength(1);
    expect(merged.yearlyData[2026].monthlyAmounts[1].h3).toBeUndefined();
  });

  it("口座名とメモを別々に変更 → 両方反映", () => {
    const local = clone(base);
    local.accounts[1].name = "SBI証券（特定）";
    const remote = clone(base);
    remote.accounts[1].holdings[0].memo = "eMAXIS オルカン";
    const merged = mergeStores(base, local, remote);
    expect(merged.accounts[1].name).toBe("SBI証券（特定）");
    expect(merged.accounts[1].holdings[0].memo).toBe("eMAXIS オルカン");
  });

  it("基準が空（初回）→ 両方の和集合", () => {
    const local = store([account("x", "A", [holding("hx")])], { "2026-01": { hx: 1 } });
    const merged = mergeStores(store([]), local, clone(base));
    expect(merged.accounts).toHaveLength(3);
    expect(merged.yearlyData[2026].monthlyAmounts[1].hx).toBe(1);
  });
});

describe("stableStringify / hasNoAmounts", () => {
  it("キーの順番が違っても同じ文字列になる", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("金額が1件もなければ true", () => {
    expect(hasNoAmounts(store(sampleAccounts()))).toBe(true);
    expect(hasNoAmounts(base)).toBe(false);
  });
});
