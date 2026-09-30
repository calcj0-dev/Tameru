import type { AssetAccount, Holding, TameruStore, YearlyData } from "../../types/asset";

/**
 * 同期用の3者マージ。
 * base（最後に同期した時点）・local（この端末）・remote（クラウド）を比べ、
 * 片方だけが変えた部分はその変更を採用する。両方が同じ箇所を別の値に変えた場合は local を優先する
 * （いま保存しようとしている＝より新しい操作とみなす）。
 *
 * - 口座・内訳: ID 単位。追加は両方から取り込み、どちらかで削除されたものは削除する
 * - 名称・メモ・資産クラス・地域: 項目ごとに判定
 * - 金額: 「年 × 月 × 内訳」のセルごとに判定
 */
export function mergeStores(base: TameruStore, local: TameruStore, remote: TameruStore): TameruStore {
  const accounts = mergeById(base.accounts, local.accounts, remote.accounts, mergeAccount);
  const liveHoldings = new Set(accounts.flatMap((a) => a.holdings.map((h) => h.id)));
  const yearlyData = mergeAmounts(base, local, remote, liveHoldings);
  return { accounts, yearlyData };
}

function mergeAccount(base: AssetAccount | undefined, local: AssetAccount, remote: AssetAccount): AssetAccount {
  return {
    id: local.id,
    name: pick(base?.name, local.name, remote.name),
    holdings: mergeById(base?.holdings ?? [], local.holdings, remote.holdings, mergeHolding),
  };
}

function mergeHolding(base: Holding | undefined, local: Holding, remote: Holding): Holding {
  return {
    id: local.id,
    memo: pick(base?.memo, local.memo, remote.memo),
    assetClass: pick(base?.assetClass, local.assetClass, remote.assetClass),
    region: pick(base?.region, local.region, remote.region),
  };
}

/** 1項目の3者マージ。local が変えていなければ remote、変えていれば local */
function pick<T>(base: T | undefined, local: T, remote: T): T {
  return local === base ? remote : local;
}

/**
 * ID を持つ配列の3者マージ。並び順は remote を基準に、local だけで追加されたものを末尾に足す。
 */
function mergeById<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  mergeItem: (base: T | undefined, local: T, remote: T) => T,
): T[] {
  const baseMap = new Map(base.map((x) => [x.id, x]));
  const localMap = new Map(local.map((x) => [x.id, x]));
  const remoteMap = new Map(remote.map((x) => [x.id, x]));

  const result: T[] = [];
  const decide = (id: string): T | null => {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (b) {
      // 同期済みだったもの: どちらかで削除されていれば削除
      if (!l || !r) return null;
      return mergeItem(b, l, r);
    }
    // 新規追加: 片方にしかなければそのまま採用（同じIDが両方にある場合はマージ）
    if (l && r) return mergeItem(undefined, l, r);
    return l ?? r ?? null;
  };

  for (const r of remote) {
    const merged = decide(r.id);
    if (merged) result.push(merged);
  }
  for (const l of local) {
    if (remoteMap.has(l.id)) continue;
    const merged = decide(l.id);
    if (merged) result.push(merged);
  }
  return result;
}

function mergeAmounts(
  base: TameruStore,
  local: TameruStore,
  remote: TameruStore,
  liveHoldings: Set<string>,
): Record<number, YearlyData> {
  const years = new Set<number>([base, local, remote].flatMap((s) => Object.keys(s.yearlyData).map(Number)));
  const yearlyData: Record<number, YearlyData> = {};

  for (const year of years) {
    const monthlyAmounts: Record<number, Record<string, number>> = {};
    for (let month = 1; month <= 12; month++) {
      const b = base.yearlyData[year]?.monthlyAmounts[month] ?? {};
      const l = local.yearlyData[year]?.monthlyAmounts[month] ?? {};
      const r = remote.yearlyData[year]?.monthlyAmounts[month] ?? {};
      const ids = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
      const merged: Record<string, number> = {};
      for (const id of ids) {
        if (!liveHoldings.has(id)) continue;
        const value = pick<number | undefined>(b[id], l[id], r[id]);
        if (typeof value === "number" && Number.isFinite(value)) merged[id] = value;
      }
      if (Object.keys(merged).length > 0) monthlyAmounts[month] = merged;
    }
    if (Object.keys(monthlyAmounts).length > 0) yearlyData[year] = { year, monthlyAmounts };
  }
  return yearlyData;
}

/**
 * キーの順序に依存しない JSON 文字列化（同期の「変更があるか」判定に使う）。
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** 金額が1件も入力されていない（初期状態のまま）か */
export function hasNoAmounts(store: TameruStore): boolean {
  return Object.keys(store.yearlyData).length === 0;
}
