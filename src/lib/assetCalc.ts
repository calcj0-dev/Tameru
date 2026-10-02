import type { AssetAccount, Holding, TameruStore } from "@/types/asset";
import { ASSET_CLASSES, MONTHS, REGIONS, accountColor } from "@/lib/constants";

export interface YearMonth {
  year: number;
  month: number;
}

/** 月を delta か月ずらす（年またぎ対応） */
export function shiftMonth(year: number, month: number, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function getMonthAmounts(
  store: TameruStore,
  year: number,
  month: number,
): Record<string, number> | undefined {
  return store.yearlyData[year]?.monthlyAmounts[month];
}

export function allHoldings(store: TameruStore): Holding[] {
  return store.accounts.flatMap((a) => a.holdings);
}

/** 指定した内訳の合計。1件も入力が無ければ null（未入力）。 */
function sumHoldings(amounts: Record<string, number> | undefined, holdings: Holding[]): number | null {
  if (!amounts) return null;
  let hasValue = false;
  let sum = 0;
  for (const h of holdings) {
    const v = amounts[h.id];
    if (typeof v === "number" && Number.isFinite(v)) {
      hasValue = true;
      sum += v;
    }
  }
  return hasValue ? sum : null;
}

/** 指定月の総合計。現存する内訳に1件も入力が無ければ null（未入力）。 */
export function getMonthTotal(store: TameruStore, year: number, month: number): number | null {
  return sumHoldings(getMonthAmounts(store, year, month), allHoldings(store));
}

/** 指定月の口座小計 */
export function getAccountMonthTotal(
  store: TameruStore,
  account: AssetAccount,
  year: number,
  month: number,
): number | null {
  return sumHoldings(getMonthAmounts(store, year, month), account.holdings);
}

export function hasMonthData(store: TameruStore, year: number, month: number): boolean {
  return getMonthTotal(store, year, month) !== null;
}

/** 年内で入力のある最新月（無ければ null） */
export function getLatestMonth(store: TameruStore, year: number): number | null {
  for (let m = 12; m >= 1; m--) {
    if (hasMonthData(store, year, m)) return m;
  }
  return null;
}

/** 入力のある年（昇順） */
function getDataYears(store: TameruStore): number[] {
  return Object.keys(store.yearlyData)
    .map(Number)
    .filter((y) => MONTHS.some((m) => hasMonthData(store, y, m)))
    .sort((a, b) => a - b);
}

/** 全期間で入力のある最新の年月（無ければ null） */
export function getLatestDataMonth(store: TameruStore): YearMonth | null {
  const years = getDataYears(store);
  const year = years[years.length - 1];
  if (year === undefined) return null;
  const month = getLatestMonth(store, year);
  return month === null ? null : { year, month };
}

/** 全期間で入力のある最も古い年月（無ければ null） */
export function getEarliestDataMonth(store: TameruStore): YearMonth | null {
  const year = getDataYears(store)[0];
  if (year === undefined) return null;
  const month = MONTHS.find((m) => hasMonthData(store, year, m));
  return month === undefined ? null : { year, month };
}

/** a < b なら負、同じなら 0、a > b なら正 */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export interface Comparison {
  base: YearMonth;
  baseTotal: number;
  diff: number;
  rate: number | null; // base が 0 の場合は null
}

export interface YearSummary {
  latest: YearMonth | null;
  total: number;
  monthOverMonth: Comparison | null;
  yearOverYear: Comparison | null;
  yearToDate: Comparison | null;
}

function compare(current: number, base: YearMonth, baseTotal: number): Comparison {
  const diff = current - baseTotal;
  return { base, baseTotal, diff, rate: baseTotal !== 0 ? diff / Math.abs(baseTotal) : null };
}

/**
 * サマリー計算（入力表で選んでいる年に関係なく、常に全期間の最新月を基準にする）。
 * - 総資産: 入力のある最新月の合計
 * - 前月比: 最新月 vs その前月（1月の場合は前年12月）
 * - 前年比: 最新月 vs 前年同月
 * - 年初比: 最新月 vs 前年12月末。前年12月が未入力なら、その年の最初の入力月
 */
export function computeSummary(store: TameruStore): YearSummary {
  const latest = getLatestDataMonth(store);
  if (latest === null) {
    return { latest: null, total: 0, monthOverMonth: null, yearOverYear: null, yearToDate: null };
  }
  const { year, month: latestMonth } = latest;
  const total = getMonthTotal(store, year, latestMonth) ?? 0;

  const prev = shiftMonth(year, latestMonth, -1);
  const prevTotal = getMonthTotal(store, prev.year, prev.month);
  const monthOverMonth = prevTotal === null ? null : compare(total, prev, prevTotal);

  const lastYearSameMonth = getMonthTotal(store, year - 1, latestMonth);
  const yearOverYear =
    lastYearSameMonth === null ? null : compare(total, { year: year - 1, month: latestMonth }, lastYearSameMonth);

  let yearToDate: Comparison | null = null;
  const lastYearEnd = getMonthTotal(store, year - 1, 12);
  if (lastYearEnd !== null) {
    yearToDate = compare(total, { year: year - 1, month: 12 }, lastYearEnd);
  } else {
    const firstMonth = MONTHS.find((m) => hasMonthData(store, year, m));
    if (firstMonth !== undefined && firstMonth !== latestMonth) {
      yearToDate = compare(total, { year, month: firstMonth }, getMonthTotal(store, year, firstMonth) ?? 0);
    }
  }

  return { latest, total, monthOverMonth, yearOverYear, yearToDate };
}

export interface TrendPoint {
  key: string; // X軸のキー（例: "2026-03"）
  year: number;
  month: number;
  total: number | null; // 未入力月は null（グラフ上は点を打たない）
  change: Comparison | null; // 前月（1月は前年12月）比。どちらかが未入力なら null
}

/** from 〜 to（両端を含む）の月次推移 */
export function buildTrendData(store: TameruStore, from: YearMonth, to: YearMonth): TrendPoint[] {
  const points: TrendPoint[] = [];
  const count = compareYearMonth(to, from) + 1;
  for (let i = 0; i < count; i++) {
    const { year, month } = shiftMonth(from.year, from.month, i);
    const total = getMonthTotal(store, year, month);
    const prev = shiftMonth(year, month, -1);
    const prevTotal = getMonthTotal(store, prev.year, prev.month);
    points.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      year,
      month,
      total,
      change: total !== null && prevTotal !== null ? compare(total, prev, prevTotal) : null,
    });
  }
  return points;
}

/**
 * 推移グラフの期間。今月（未来の月まで入力があればその月）を終点に、直近 years 年分。
 * years が "all" の場合は、入力のある最古の月から（最短でも直近12か月）。
 */
export function trendPeriod(store: TameruStore, today: YearMonth, years: number | "all"): { from: YearMonth; to: YearMonth } {
  const latest = getLatestDataMonth(store);
  const to = latest && compareYearMonth(latest, today) > 0 ? latest : today;
  const lastYear = shiftMonth(to.year, to.month, -11);
  if (years !== "all") return { from: shiftMonth(to.year, to.month, -(years * 12 - 1)), to };
  const earliest = getEarliestDataMonth(store);
  const from = earliest && compareYearMonth(earliest, lastYear) < 0 ? earliest : lastYear;
  return { from, to };
}

export interface AllocationSlice {
  id: string;
  name: string;
  value: number;
  ratio: number;
  color: string;
}

export type AllocationMode = "account" | "assetClass" | "region";

/**
 * 構成比。口座別 / 資産クラス別 / 地域別に内訳の金額を合算する。
 * 0円・マイナス（負債等）は円グラフに含めない。
 */
export function buildAllocationData(
  store: TameruStore,
  year: number,
  month: number,
  mode: AllocationMode,
): AllocationSlice[] {
  const amounts = getMonthAmounts(store, year, month) ?? {};
  const sumOf = (holdings: Holding[]) =>
    holdings.reduce((acc, h) => {
      const v = amounts[h.id];
      return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
    }, 0);
  const holdings = allHoldings(store);

  const slices =
    mode === "account"
      ? store.accounts.map((a, i) => ({
          id: a.id,
          name: a.name || "（名称未設定）",
          value: sumOf(a.holdings),
          color: accountColor(i),
        }))
      : mode === "assetClass"
        ? ASSET_CLASSES.map((c) => ({
            id: c.id,
            name: c.label,
            value: sumOf(holdings.filter((h) => h.assetClass === c.id)),
            color: c.color,
          }))
        : REGIONS.map((r) => ({
            id: r.id,
            name: r.id === "none" ? "地域なし" : r.label,
            value: sumOf(holdings.filter((h) => h.region === r.id)),
            color: r.color,
          }));

  const positive = slices.filter((s) => s.value > 0);
  const sum = positive.reduce((acc, s) => acc + s.value, 0);
  return positive
    .map((s) => ({ ...s, ratio: sum > 0 ? s.value / sum : 0 }))
    .sort((a, b) => b.value - a.value);
}

