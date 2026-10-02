import { describe, expect, it } from "vitest";
import {
  buildAllocationData,
  buildTrendData,
  computeSummary,
  getAccountMonthTotal,
  getMonthTotal,
  shiftMonth,
  trendPeriod,
} from "@/lib/assetCalc";
import { sampleAccounts, store } from "./helpers";

describe("shiftMonth（年またぎの月計算）", () => {
  it("前月・翌月・年またぎ", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftMonth(2026, 10, -11)).toEqual({ year: 2025, month: 11 });
  });
});

describe("月の合計", () => {
  const s = store(sampleAccounts(), { "2026-01": { h1: 100, h2: 200 }, "2026-02": { h1: 0, h2: 0, h3: 0 } });

  it("入力された内訳の合計", () => {
    expect(getMonthTotal(s, 2026, 1)).toBe(300);
  });

  it("未入力の月は null、0円だけの月は 0（区別する）", () => {
    expect(getMonthTotal(s, 2026, 3)).toBeNull();
    expect(getMonthTotal(s, 2026, 2)).toBe(0);
  });

  it("口座ごとの小計", () => {
    expect(getAccountMonthTotal(s, s.accounts[1], 2026, 1)).toBe(200);
    expect(getAccountMonthTotal(s, s.accounts[1], 2026, 3)).toBeNull();
  });

  it("削除済みの内訳の金額は合計に含めない", () => {
    const withGhost = store(sampleAccounts(), { "2026-01": { h1: 100, deleted: 999 } });
    expect(getMonthTotal(withGhost, 2026, 1)).toBe(100);
  });
});

describe("computeSummary（サマリーカード）", () => {
  it("データがなければ総資産0・比較なし", () => {
    const summary = computeSummary(store(sampleAccounts()));
    expect(summary.latest).toBeNull();
    expect(summary.total).toBe(0);
    expect(summary.monthOverMonth).toBeNull();
  });

  it("全期間で入力のある最新月を使う（入力表の年に関係しない）", () => {
    const s = store(sampleAccounts(), {
      "2025-09": { h1: 4_000_000 },
      "2025-12": { h1: 4_500_000 },
      "2026-08": { h1: 4_800_000 },
      "2026-09": { h1: 4_946_161 },
    });
    const summary = computeSummary(s);
    expect(summary.latest).toEqual({ year: 2026, month: 9 });
    expect(summary.total).toBe(4_946_161);
    // 前月比・前年比・年初比
    expect(summary.monthOverMonth?.diff).toBe(146_161);
    expect(summary.yearOverYear?.base).toEqual({ year: 2025, month: 9 });
    expect(summary.yearOverYear?.diff).toBe(946_161);
    expect(summary.yearToDate?.base).toEqual({ year: 2025, month: 12 });
    expect(summary.yearToDate?.diff).toBe(446_161);
  });

  it("前年12月がなければ、年初比はその年の最初の入力月と比べる", () => {
    const s = store(sampleAccounts(), { "2026-03": { h1: 100 }, "2026-06": { h1: 150 } });
    expect(computeSummary(s).yearToDate?.base).toEqual({ year: 2026, month: 3 });
    expect(computeSummary(s).yearToDate?.rate).toBeCloseTo(0.5);
  });

  it("比較元が0円のときは率を出さない（0除算しない）", () => {
    const s = store(sampleAccounts(), { "2026-01": { h1: 0 }, "2026-02": { h1: 100 } });
    expect(computeSummary(s).monthOverMonth?.rate).toBeNull();
  });
});

describe("trendPeriod（資産推移グラフの期間）", () => {
  const today = { year: 2026, month: 10 };

  it("1年 = 今月を終点にした直近12か月", () => {
    expect(trendPeriod(store(sampleAccounts()), today, 1)).toEqual({
      from: { year: 2025, month: 11 },
      to: { year: 2026, month: 10 },
    });
  });

  it("3年 = 直近36か月", () => {
    expect(trendPeriod(store(sampleAccounts()), today, 3).from).toEqual({ year: 2023, month: 11 });
  });

  it("全期間 = 入力のある最古の月から（最短でも12か月）", () => {
    const old = store(sampleAccounts(), { "2022-04": { h1: 1 } });
    expect(trendPeriod(old, today, "all").from).toEqual({ year: 2022, month: 4 });
    const recent = store(sampleAccounts(), { "2026-09": { h1: 1 } });
    expect(trendPeriod(recent, today, "all").from).toEqual({ year: 2025, month: 11 });
  });

  it("未来の月に入力があれば、その月まで表示する", () => {
    const future = store(sampleAccounts(), { "2026-12": { h1: 1 } });
    expect(trendPeriod(future, today, 1).to).toEqual({ year: 2026, month: 12 });
  });
});

describe("buildTrendData（推移データ）", () => {
  it("期間の各月を並べ、未入力の月は null、前月比を計算する", () => {
    const s = store(sampleAccounts(), { "2025-12": { h1: 100 }, "2026-01": { h1: 110 } });
    const points = buildTrendData(s, { year: 2025, month: 12 }, { year: 2026, month: 2 });
    expect(points.map((p) => p.key)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(points[1].total).toBe(110);
    expect(points[1].change?.diff).toBe(10); // 1月は前年12月と比較
    expect(points[2].total).toBeNull();
    expect(points[2].change).toBeNull();
  });
});

describe("buildAllocationData（構成比）", () => {
  const s = store(sampleAccounts(), { "2026-01": { h1: 1000, h2: 3000, h3: 1000 } });

  it("資産クラス別", () => {
    const slices = buildAllocationData(s, 2026, 1, "assetClass");
    expect(slices.map((x) => [x.name, x.value])).toEqual([
      ["投資信託", 3000],
      ["現金・預金", 1000],
      ["株式", 1000],
    ]);
    expect(slices.reduce((sum, x) => sum + x.ratio, 0)).toBeCloseTo(1);
  });

  it("地域別・口座別", () => {
    expect(buildAllocationData(s, 2026, 1, "region").map((x) => x.name)).toEqual(["全世界", "日本", "米国"]);
    expect(buildAllocationData(s, 2026, 1, "account").map((x) => [x.name, x.value])).toEqual([
      ["SBI証券", 4000],
      ["銀行", 1000],
    ]);
  });

  it("0円・マイナス（負債など）は円グラフに含めない", () => {
    const withDebt = store(sampleAccounts(), { "2026-01": { h1: 1000, h2: 0, h3: -500 } });
    expect(buildAllocationData(withDebt, 2026, 1, "account").map((x) => x.name)).toEqual(["銀行"]);
  });
});
