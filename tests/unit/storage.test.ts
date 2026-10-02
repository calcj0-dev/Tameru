import { describe, expect, it } from "vitest";
import { createInitialStore, sanitizeStore } from "@/lib/storage";

/** 内訳を「メモ|資産クラス|地域」の文字列にして比べやすくする */
function shape(store: ReturnType<typeof sanitizeStore>) {
  return store?.accounts.map((a) => [a.name, a.holdings.map((h) => `${h.memo}|${h.assetClass}|${h.region}`)]);
}

describe("初期データ", () => {
  it("サンプル口座と内訳を持ち、金額は空", () => {
    const s = createInitialStore();
    expect(s.accounts.length).toBeGreaterThan(0);
    expect(s.accounts.every((a) => a.holdings.length > 0)).toBe(true);
    expect(s.yearlyData).toEqual({});
    // ID は重複しない
    const ids = s.accounts.flatMap((a) => [a.id, ...a.holdings.map((h) => h.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("保存データの読み込み（形式の自動変換）", () => {
  it("v1（カテゴリ名だけ）→ 口座＋内訳。名前から資産クラス・地域を推測し、金額は引き継ぐ", () => {
    const s = sanitizeStore({
      categories: [
        { id: "c1", name: "銀行預金" },
        { id: "c2", name: "楽天 オルカン" },
        { id: "c3", name: "純金積立" },
      ],
      yearlyData: { 2026: { year: 2026, monthlyAmounts: { 1: { c1: 100, c2: 200 } } } },
    });
    expect(shape(s)).toEqual([
      ["銀行預金", ["|cash|japan"]],
      ["楽天 オルカン", ["|fund|global"]],
      ["純金積立", ["|gold|none"]],
    ]);
    expect(s?.yearlyData[2026].monthlyAmounts[1]).toEqual({ c1: 100, c2: 200 });
  });

  it("v2（名称＋カテゴリ）→ 同じ名前の行は1つの口座にまとめる", () => {
    const s = sanitizeStore({
      accounts: [
        { id: "r1", name: "SBI証券", category: "jp_stock" },
        { id: "r2", name: "SBI証券", category: "us_stock" },
        { id: "r3", name: "楽天証券", category: "fund" },
      ],
      yearlyData: {},
    });
    expect(shape(s)).toEqual([
      ["SBI証券", ["日本株|stock|japan", "米国株|stock|us"]],
      ["楽天証券", ["投資信託|fund|none"]],
    ]);
    // 行の ID は内訳の ID として引き継ぐ（金額データがそのまま使える）
    expect(s?.accounts[0].holdings.map((h) => h.id)).toEqual(["r1", "r2"]);
  });

  it("v3 の不正な値を取り除く（NaN・範囲外の月・未知の資産クラス）", () => {
    const s = sanitizeStore({
      accounts: [{ id: "a1", name: "X", holdings: [{ id: "h1", memo: 1, assetClass: "reit", region: "mars" }] }],
      yearlyData: {
        2026: { year: 2026, monthlyAmounts: { 1: { h1: "abc" }, 13: { h1: 1 }, 2: { h1: 5, h2: Number.NaN } } },
        foo: { year: 0, monthlyAmounts: {} },
      },
    });
    expect(shape(s)).toEqual([["X", ["|other|none"]]]);
    expect(s?.yearlyData).toEqual({ 2026: { year: 2026, monthlyAmounts: { 2: { h1: 5 } } } });
  });

  it("口座の一部が壊れていても、v3 として読み込み内訳を失わない", () => {
    const s = sanitizeStore({
      accounts: [{ id: "a1", name: "ok", holdings: [{ id: "h1" }] }, { broken: true }],
      yearlyData: {},
    });
    expect(s?.accounts.map((a) => a.holdings.length)).toEqual([1]);
  });

  it("形式が全く違うデータは null（読み込まない）", () => {
    expect(sanitizeStore(null)).toBeNull();
    expect(sanitizeStore({})).toBeNull();
    expect(sanitizeStore({ accounts: [] })).toBeNull();
  });
});
