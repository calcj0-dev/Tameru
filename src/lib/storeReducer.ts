import type { AssetCategory, TameruStore } from "@/types/asset";
import { MAX_CATEGORIES } from "@/lib/constants";
import { getMonthAmounts, shiftMonth } from "@/lib/assetCalc";

export type StoreAction =
  | { type: "hydrate"; store: TameruStore }
  | { type: "addCategory"; category: AssetCategory }
  | { type: "renameCategory"; id: string; name: string }
  | { type: "removeCategory"; id: string }
  | { type: "setAmount"; year: number; month: number; categoryId: string; value: number | null }
  | { type: "copyPreviousMonth"; year: number; month: number };

export interface StoreState {
  store: TameruStore;
  isLoaded: boolean;
}

export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  if (action.type === "hydrate") {
    return { store: action.store, isLoaded: true };
  }
  const next = applyAction(state.store, action);
  return next === state.store ? state : { ...state, store: next };
}

function applyAction(store: TameruStore, action: Exclude<StoreAction, { type: "hydrate" }>): TameruStore {
  switch (action.type) {
    case "addCategory":
      if (store.categories.length >= MAX_CATEGORIES) return store;
      return { ...store, categories: [...store.categories, action.category] };

    case "renameCategory":
      return {
        ...store,
        categories: store.categories.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)),
      };

    case "removeCategory": {
      const categories = store.categories.filter((c) => c.id !== action.id);
      let next: TameruStore = { ...store, categories };
      for (const yd of Object.values(store.yearlyData)) {
        for (const month of Object.keys(yd.monthlyAmounts).map(Number)) {
          next = updateMonth(next, yd.year, month, (prev) => {
            if (!(action.id in prev)) return prev;
            const rest = { ...prev };
            delete rest[action.id];
            return rest;
          });
        }
      }
      return next;
    }

    case "setAmount":
      return updateMonth(store, action.year, action.month, (prev) => {
        if (action.value === null) {
          if (!(action.categoryId in prev)) return prev;
          const rest = { ...prev };
          delete rest[action.categoryId];
          return rest;
        }
        if (prev[action.categoryId] === action.value) return prev;
        return { ...prev, [action.categoryId]: action.value };
      });

    case "copyPreviousMonth": {
      const src = shiftMonth(action.year, action.month, -1);
      const srcAmounts = getMonthAmounts(store, src.year, src.month) ?? {};
      const copied: Record<string, number> = {};
      for (const c of store.categories) {
        if (typeof srcAmounts[c.id] === "number") copied[c.id] = srcAmounts[c.id];
      }
      return updateMonth(store, action.year, action.month, () => copied);
    }
  }
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
