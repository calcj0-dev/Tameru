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
  yearToDate: Comparison | null;
}

function compare(current: number, base: YearMonth, baseTotal: number): Comparison {
  const diff = current - baseTotal;
  return { base, baseTotal, diff, rate: baseTotal !== 0 ? diff / Math.abs(baseTotal) : null };
}

/**
 * サマリー計算。
 * - 総資産: 選択年で入力のある最新月の合計
 * - 前月比: 最新月 vs その前月（1月の場合は前年12月）
 * - 年初比: 最新月 vs 前年12月末。前年12月が未入力なら、その年の最初の入力月
 */
export function computeSummary(store: TameruStore, year: number): YearSummary {
  const latestMonth = getLatestMonth(store, year);
  if (latestMonth === null) {
    return { latest: null, total: 0, monthOverMonth: null, yearToDate: null };
  }
  const latest = { year, month: latestMonth };
  const total = getMonthTotal(store, year, latestMonth) ?? 0;

  const prev = shiftMonth(year, latestMonth, -1);
  const prevTotal = getMonthTotal(store, prev.year, prev.month);
  const monthOverMonth = prevTotal === null ? null : compare(total, prev, prevTotal);

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

  return { latest, total, monthOverMonth, yearToDate };
}

export interface TrendPoint {
  month: number;
  label: string;
  total: number | null; // 未入力月は null（グラフ上は点を打たない）
}

export function buildTrendData(store: TameruStore, year: number): TrendPoint[] {
  return MONTHS.map((m) => ({ month: m, label: `${m}月`, total: getMonthTotal(store, year, m) }));
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

