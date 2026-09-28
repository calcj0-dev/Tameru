import type { AssetAccount, AssetClassId, Holding, RegionId, TameruStore, YearlyData } from "@/types/asset";
import { DEFAULT_ASSET_CLASS, DEFAULT_REGION, isAssetClassId, isRegionId } from "@/lib/constants";

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
// v1: { categories: {id, name}[] }
// v2: { accounts: {id, name, category}[] }
// v3: { accounts: {id, name, holdings: {id, memo, assetClass, region}[]}[] }
const SCHEMA_VERSION = 3;

interface PersistedEnvelope {
  version: number;
  savedAt: string;
  data: TameruStore;
}

export function generateId(prefix: "acc" | "hold"): string {
  // crypto.randomUUID は非セキュアコンテキスト（LAN上のhttp等）では使えないためフォールバックを用意
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function createHolding(patch: Partial<Omit<Holding, "id">> = {}): Holding {
  return {
    id: generateId("hold"),
    memo: "",
    assetClass: DEFAULT_ASSET_CLASS,
    region: DEFAULT_REGION,
    ...patch,
  };
}

export function createInitialStore(): TameruStore {
  return {
    accounts: [
      {
        id: generateId("acc"),
        name: "銀行",
        holdings: [createHolding({ memo: "普通預金", assetClass: "cash", region: "japan" })],
      },
      {
        id: generateId("acc"),
        name: "SBI証券",
        holdings: [
          createHolding({ memo: "オルカン", assetClass: "fund", region: "global" }),
          createHolding({ memo: "預り金", assetClass: "cash", region: "japan" }),
        ],
      },
      {
        id: generateId("acc"),
        name: "楽天証券",
        holdings: [createHolding({ memo: "S&P500", assetClass: "fund", region: "us" })],
      },
    ],
    yearlyData: {},
  };
}

export function createEmptyStore(): TameruStore {
  return { accounts: [], yearlyData: {} };
}

/** 保存データを検証し、不正な値（NaN、範囲外の月など）を取り除いて返す。v1 / v2 形式も v3 へ変換する。 */
export function sanitizeStore(raw: unknown): TameruStore | null {
  if (!isObject(raw) || !isObject(raw.yearlyData)) return null;

  let accounts: AssetAccount[];
  // holdings を持つ口座が1つでもあれば v3（一部が壊れていても v2 と誤判定して内訳を失わないように）
  if (Array.isArray(raw.accounts) && (raw.accounts.length === 0 || raw.accounts.some((a) => isObject(a) && Array.isArray(a.holdings)))) {
    accounts = raw.accounts.filter(isObject).flatMap((a) => {
      if (typeof a.id !== "string" || typeof a.name !== "string" || !Array.isArray(a.holdings)) return [];
      const holdings = a.holdings.filter(isObject).flatMap((h): Holding[] =>
        typeof h.id === "string"
          ? [
              {
                id: h.id,
                memo: typeof h.memo === "string" ? h.memo : "",
                assetClass: isAssetClassId(h.assetClass) ? h.assetClass : DEFAULT_ASSET_CLASS,
                region: isRegionId(h.region) ? h.region : DEFAULT_REGION,
              },
            ]
          : [],
      );
      return [{ id: a.id, name: a.name, holdings }];
    });
  } else if (Array.isArray(raw.accounts)) {
    accounts = migrateRows(raw.accounts, (r) => migrateV2Category(r.category, r.name));
  } else if (Array.isArray(raw.categories)) {
    accounts = migrateRows(raw.categories, (r) => guessFromName(r.name));
  } else {
    return null;
  }
  // 上限（MAX_ACCOUNTS 等）は「追加」操作でのみ制限し、既存データは切り捨てない

  const yearlyData: Record<number, YearlyData> = {};
  for (const [yearKey, yd] of Object.entries(raw.yearlyData)) {
    const year = Number(yearKey);
    if (!Number.isInteger(year) || !isObject(yd) || !isObject(yd.monthlyAmounts)) continue;

    const monthlyAmounts: Record<number, Record<string, number>> = {};
    for (const [monthKey, amounts] of Object.entries(yd.monthlyAmounts)) {
      const month = Number(monthKey);
      if (!Number.isInteger(month) || month < 1 || month > 12 || !isObject(amounts)) continue;
      const clean: Record<string, number> = {};
      for (const [holdingId, value] of Object.entries(amounts)) {
        if (typeof value === "number" && Number.isFinite(value)) clean[holdingId] = value;
      }
      if (Object.keys(clean).length > 0) monthlyAmounts[month] = clean;
    }
    if (Object.keys(monthlyAmounts).length > 0) yearlyData[year] = { year, monthlyAmounts };
  }

  return { accounts, yearlyData };
}

// ---------------------------------------------------------------------------
// v1 / v2 → v3 移行
// 旧形式の1行 = 新形式の内訳1件。行IDを内訳IDとして引き継ぐので金額データはそのまま使える。
// 同じ名称の行は1つの口座にまとめる。
// ---------------------------------------------------------------------------

type Classified = { assetClass: AssetClassId; region: RegionId; memo: string };

function migrateRows(
  rows: unknown[],
  classify: (row: Record<string, unknown> & { id: string; name: string }) => Classified,
): AssetAccount[] {
  const accounts: AssetAccount[] = [];
  const byName = new Map<string, AssetAccount>();
  for (const r of rows) {
    if (!isObject(r) || typeof r.id !== "string" || typeof r.name !== "string") continue;
    const row = r as Record<string, unknown> & { id: string; name: string };
    const holding: Holding = { id: row.id, ...classify(row) };
    const key = row.name.trim();
    const existing = key ? byName.get(key) : undefined;
    if (existing) {
      existing.holdings.push(holding);
    } else {
      const account: AssetAccount = { id: generateId("acc"), name: row.name, holdings: [holding] };
      accounts.push(account);
      if (key) byName.set(key, account);
    }
  }
  return accounts;
}

const V2_CATEGORY_LABELS: Record<string, string> = {
  cash: "現金",
  jp_stock: "日本株",
  us_stock: "米国株",
  fund: "投資信託",
  bond: "債券",
  gold: "ゴールド",
  crypto: "暗号資産",
  other: "",
};

function migrateV2Category(category: unknown, name: string): Classified {
  const memo = typeof category === "string" ? (V2_CATEGORY_LABELS[category] ?? "") : "";
  switch (category) {
    case "cash":
      return { assetClass: "cash", region: "japan", memo };
    case "jp_stock":
      return { assetClass: "stock", region: "japan", memo };
    case "us_stock":
      return { assetClass: "stock", region: "us", memo };
    case "bond":
      return { assetClass: "bond", region: guessRegion(name), memo };
    case "gold":
      return { assetClass: "gold", region: "none", memo };
    case "crypto":
      return { assetClass: "crypto", region: "none", memo };
    case "fund":
      return { assetClass: "fund", region: guessRegion(name), memo };
    default:
      return { ...guessFromName(name), memo };
  }
}

function guessFromName(name: string): Classified {
  if (/銀行|預金|現金|財布|貯金/.test(name)) return { assetClass: "cash", region: "japan", memo: "" };
  if (/純金|金積立|ゴールド|gold/i.test(name)) return { assetClass: "gold", region: "none", memo: "" };
  if (/暗号|仮想通貨|ビットコイン|BTC|ETH/i.test(name)) return { assetClass: "crypto", region: "none", memo: "" };
  if (/債/.test(name)) return { assetClass: "bond", region: guessRegion(name), memo: "" };
  const region = guessRegion(name);
  if (/投信|投資信託|ファンド|オルカン|インデックス|eMAXIS|NISA|iDeCo/i.test(name)) {
    return { assetClass: "fund", region, memo: "" };
  }
  if (region !== "none" || /株|S&P/i.test(name)) {
    return { assetClass: "stock", region, memo: "" };
  }
  return { assetClass: DEFAULT_ASSET_CLASS, region: DEFAULT_REGION, memo: "" };
}

function guessRegion(name: string): RegionId {
  if (/オルカン|全世界|オール・?カントリー/i.test(name)) return "global";
  if (/米国|米株|S&P|NASDAQ|ナスダック|US/i.test(name)) return "us";
  if (/新興国|エマージング/.test(name)) return "emerging";
  if (/先進国/.test(name)) return "developed";
  if (/日本|国内|日経|TOPIX/i.test(name)) return "japan";
  return "none";
}

// ---------------------------------------------------------------------------

export const localStorageAdapter: StorageAdapter = {
  async load() {
    if (typeof window === "undefined") return null;
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    try {
      const envelope = JSON.parse(text) as Partial<PersistedEnvelope>;
      const store = sanitizeStore(envelope.data);
      if (store) {
        // 形式が変わる場合は、移行前のデータを念のため退避しておく
        if (envelope.version !== SCHEMA_VERSION) {
          window.localStorage.setItem(`${STORAGE_KEY}:backup:v${envelope.version ?? "?"}`, text);
        }
        return store;
      }
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
