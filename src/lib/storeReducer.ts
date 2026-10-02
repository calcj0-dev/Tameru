import type { AssetAccount, Holding, TameruStore } from "@/types/asset";
import { MAX_ACCOUNTS, MAX_HOLDINGS_PER_ACCOUNT, suggestRegion } from "@/lib/constants";
import { allHoldings, getMonthAmounts, shiftMonth } from "@/lib/assetCalc";

export type HoldingPatch = Partial<Omit<Holding, "id">>;

export type StoreAction =
  | { type: "hydrate"; store: TameruStore }
  | { type: "replace"; store: TameruStore } // 同期でクラウドのデータに置き換える
  | { type: "addAccount"; account: AssetAccount }
  | { type: "renameAccount"; accountId: string; name: string }
  | { type: "removeAccount"; accountId: string }
  | { type: "addHolding"; accountId: string; holding: Holding }
  | { type: "updateHolding"; holdingId: string; patch: HoldingPatch }
  | { type: "removeHolding"; holdingId: string }
  | { type: "setAmount"; year: number; month: number; holdingId: string; value: number | null }
  | { type: "copyPreviousMonth"; year: number; month: number };

export interface StoreState {
  store: TameruStore;
  isLoaded: boolean;
}

export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  if (action.type === "hydrate") {
    return { store: action.store, isLoaded: true };
  }
  if (action.type === "replace") {
    return { ...state, store: action.store };
  }
  const next = applyEditAction(state.store, action);
  return next === state.store ? state : { ...state, store: next };
}

/** 入力表で行う編集操作（下書きにも本データにも同じ処理を使う） */
export type EditAction = Exclude<StoreAction, { type: "hydrate" } | { type: "replace" }>;

export function applyEditAction(store: TameruStore, action: EditAction): TameruStore {
  switch (action.type) {
    case "addAccount":
      if (store.accounts.length >= MAX_ACCOUNTS) return store;
      return { ...store, accounts: [...store.accounts, action.account] };

    case "renameAccount":
      return mapAccounts(store, (a) => (a.id === action.accountId ? { ...a, name: action.name } : a));

    case "removeAccount": {
      const target = store.accounts.find((a) => a.id === action.accountId);
      if (!target) return store;
      const next = { ...store, accounts: store.accounts.filter((a) => a.id !== action.accountId) };
      return removeAmounts(next, new Set(target.holdings.map((h) => h.id)));
    }

    case "addHolding":
      return mapAccounts(store, (a) =>
        a.id === action.accountId && a.holdings.length < MAX_HOLDINGS_PER_ACCOUNT
          ? { ...a, holdings: [...a.holdings, action.holding] }
          : a,
      );

    case "updateHolding":
      return mapAccounts(store, (a) => {
        if (!a.holdings.some((h) => h.id === action.holdingId)) return a;
        return {
          ...a,
          holdings: a.holdings.map((h) => {
            if (h.id !== action.holdingId) return h;
            const next = { ...h, ...action.patch };
            // 資産クラスだけ変更された場合は地域を自動補完
            if (action.patch.assetClass && !action.patch.region) {
              next.region = suggestRegion(next.assetClass, h.region);
            }
            return next;
          }),
        };
      });

    case "removeHolding": {
      const next = mapAccounts(store, (a) =>
        a.holdings.some((h) => h.id === action.holdingId)
          ? { ...a, holdings: a.holdings.filter((h) => h.id !== action.holdingId) }
          : a,
      );
      return removeAmounts(next, new Set([action.holdingId]));
    }

    case "setAmount":
      return updateMonth(store, action.year, action.month, (prev) => {
        if (action.value === null) {
          if (!(action.holdingId in prev)) return prev;
          const rest = { ...prev };
          delete rest[action.holdingId];
          return rest;
        }
        if (prev[action.holdingId] === action.value) return prev;
        return { ...prev, [action.holdingId]: action.value };
      });

    case "copyPreviousMonth": {
      const src = shiftMonth(action.year, action.month, -1);
      const srcAmounts = getMonthAmounts(store, src.year, src.month) ?? {};
      const copied: Record<string, number> = {};
      for (const h of allHoldings(store)) {
        if (typeof srcAmounts[h.id] === "number") copied[h.id] = srcAmounts[h.id];
      }
      return updateMonth(store, action.year, action.month, () => copied);
    }
  }
}

/**
 * 1件以上入力がある月の空欄を 0 で埋める（全期間が対象）。
 * まったく入力のない月（未来の月など）は空欄のまま残す。
 * 入力途中の月が「最新月」として集計され、総資産が実際より少なく見えるのを防ぐため保存時に使う。
 */
export function fillEmptyWithZero(store: TameruStore): TameruStore {
  const holdingIds = allHoldings(store).map((h) => h.id);
  let next = store;
  for (const yd of Object.values(store.yearlyData)) {
    for (const month of Object.keys(yd.monthlyAmounts).map(Number)) {
      next = updateMonth(next, yd.year, month, (prev) => {
        if (!holdingIds.some((id) => typeof prev[id] === "number")) return prev;
        const missing = holdingIds.filter((id) => typeof prev[id] !== "number");
        if (missing.length === 0) return prev;
        return { ...prev, ...Object.fromEntries(missing.map((id) => [id, 0])) };
      });
    }
  }
  return next;
}

function mapAccounts(store: TameruStore, fn: (a: AssetAccount) => AssetAccount): TameruStore {
  let changed = false;
  const accounts = store.accounts.map((a) => {
    const next = fn(a);
    if (next !== a) changed = true;
    return next;
  });
  return changed ? { ...store, accounts } : store;
}

/** 指定した内訳IDの金額を全年度から削除する */
function removeAmounts(store: TameruStore, holdingIds: Set<string>): TameruStore {
  let next = store;
  for (const yd of Object.values(store.yearlyData)) {
    for (const month of Object.keys(yd.monthlyAmounts).map(Number)) {
      next = updateMonth(next, yd.year, month, (prev) => {
        if (!Object.keys(prev).some((id) => holdingIds.has(id))) return prev;
        return Object.fromEntries(Object.entries(prev).filter(([id]) => !holdingIds.has(id)));
      });
    }
  }
  return next;
}

/** 月データを不変更新する。空になった月・年はキーごと削除してストレージを軽く保つ。 */
function updateMonth(
  store: TameruStore,
  year: number,
  month: number,
  updater: (prev: Record<string, number>) => Record<string, number>,
): TameruStore {
  const prev = getMonthAmounts(store, year, month) ?? {};
  const nextAmounts = updater(prev);
  if (nextAmounts === prev) return store;

  const monthlyAmounts = { ...(store.yearlyData[year]?.monthlyAmounts ?? {}) };
  if (Object.keys(nextAmounts).length > 0) {
    monthlyAmounts[month] = nextAmounts;
  } else {
    delete monthlyAmounts[month];
  }

  const yearlyData = { ...store.yearlyData };
  if (Object.keys(monthlyAmounts).length > 0) {
    yearlyData[year] = { year, monthlyAmounts };
  } else {
    delete yearlyData[year];
  }
  return { ...store, yearlyData };
}
