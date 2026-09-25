import type { AssetCategory, TameruStore, YearlyData } from "@/types/asset";
import { MAX_CATEGORIES } from "@/lib/constants";

/**
 * 永続化の抽象化レイヤー。
 * フェーズ2以降で Supabase / Google Drive 等のアダプタを同じインターフェースで差し替える想定のため、
 * LocalStorage 版も非同期 API として定義している。
 */
export interface StorageAdapter {
  load(): Promise<TameruStore | null>;
  save(store: TameruStore): Promise<void>;
}

export const STORAGE_KEY = "tameru:store";
const SCHEMA_VERSION = 1;

interface PersistedEnvelope {
  version: number;
  savedAt: string;
  data: TameruStore;
}

const DEFAULT_CATEGORY_NAMES = ["銀行預金", "SBI証券", "楽天証券", "現金"];

export function generateId(prefix = "cat"): string {
  // crypto.randomUUID は非セキュアコンテキスト（LAN上のhttp等）では使えないためフォールバックを用意
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function createInitialStore(): TameruStore {
  return {
    categories: DEFAULT_CATEGORY_NAMES.map((name) => ({ id: generateId(), name })),
    yearlyData: {},
  };
}

export function createEmptyStore(): TameruStore {
  return { categories: [], yearlyData: {} };
}

/** 保存データを検証し、不正な値（NaN、範囲外の月など）を取り除いて返す。 */
export function sanitizeStore(raw: unknown): TameruStore | null {
  if (!isObject(raw) || !Array.isArray(raw.categories) || !isObject(raw.yearlyData)) {
    return null;
  }

  const categories: AssetCategory[] = raw.categories
    .filter((c): c is AssetCategory => isObject(c) && typeof c.id === "string" && typeof c.name === "string")
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({ id: c.id, name: c.name }));

  const yearlyData: Record<number, YearlyData> = {};
  for (const [yearKey, yd] of Object.entries(raw.yearlyData)) {
    const year = Number(yearKey);
    if (!Number.isInteger(year) || !isObject(yd) || !isObject(yd.monthlyAmounts)) continue;

    const monthlyAmounts: Record<number, Record<string, number>> = {};
    for (const [monthKey, amounts] of Object.entries(yd.monthlyAmounts)) {
      const month = Number(monthKey);
      if (!Number.isInteger(month) || month < 1 || month > 12 || !isObject(amounts)) continue;
      const clean: Record<string, number> = {};
      for (const [catId, value] of Object.entries(amounts)) {
        if (typeof value === "number" && Number.isFinite(value)) clean[catId] = value;
      }
      if (Object.keys(clean).length > 0) monthlyAmounts[month] = clean;
    }
    if (Object.keys(monthlyAmounts).length > 0) yearlyData[year] = { year, monthlyAmounts };
  }

  return { categories, yearlyData };
}

export const localStorageAdapter: StorageAdapter = {
  async load() {
    if (typeof window === "undefined") return null;
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    try {
      const envelope = JSON.parse(text) as Partial<PersistedEnvelope>;
      const store = sanitizeStore(envelope.data);
      if (store) return store;
    } catch {
      // fallthrough
    }
    // 壊れたデータで初期データに上書きしてしまわないよう、退避してから null を返す
    window.localStorage.setItem(`${STORAGE_KEY}:backup:${Date.now()}`, text);
    return null;
  },

  async save(store) {
    if (typeof window === "undefined") return;
    const envelope: PersistedEnvelope = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      data: store,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
