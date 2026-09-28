import type { AssetClassId, RegionId } from "@/types/asset";

export const MAX_ACCOUNTS = 6;
export const MAX_HOLDINGS_PER_ACCOUNT = 10;

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

interface Option<T extends string> {
  id: T;
  label: string;
  shortLabel?: string; // 入力テーブルのプルダウン用（幅を抑える）
  color: string;
}

/** 資産クラス（表示順） */
export const ASSET_CLASSES: readonly Option<AssetClassId>[] = [
  { id: "cash", label: "現金・預金", shortLabel: "現金", color: "#0ea5e9" },
  { id: "stock", label: "株式", color: "#6366f1" },
  { id: "bond", label: "債券", color: "#84cc16" },
  { id: "reit", label: "REIT・不動産", shortLabel: "REIT", color: "#f97316" },
  { id: "gold", label: "ゴールド", color: "#f59e0b" },
  { id: "crypto", label: "暗号資産", color: "#8b5cf6" },
  { id: "other", label: "その他", color: "#64748b" },
];

/** 地域（表示順） */
export const REGIONS: readonly Option<RegionId>[] = [
  { id: "japan", label: "日本", color: "#f43f5e" },
  { id: "us", label: "米国", color: "#6366f1" },
  { id: "developed", label: "先進国", color: "#0ea5e9" },
  { id: "emerging", label: "新興国", color: "#f59e0b" },
  { id: "global", label: "全世界", color: "#0d9488" },
  { id: "none", label: "なし", color: "#94a3b8" },
];

export const DEFAULT_ASSET_CLASS: AssetClassId = "other";
export const DEFAULT_REGION: RegionId = "none";

const CLASS_MAP = new Map(ASSET_CLASSES.map((c) => [c.id, c]));
const REGION_MAP = new Map(REGIONS.map((r) => [r.id, r]));

export function isAssetClassId(v: unknown): v is AssetClassId {
  return typeof v === "string" && CLASS_MAP.has(v as AssetClassId);
}

export function isRegionId(v: unknown): v is RegionId {
  return typeof v === "string" && REGION_MAP.has(v as RegionId);
}

export function assetClassLabel(id: AssetClassId): string {
  return CLASS_MAP.get(id)?.label ?? "その他";
}

export function assetClassColor(id: AssetClassId): string {
  return CLASS_MAP.get(id)?.color ?? "#64748b";
}

export function regionLabel(id: RegionId): string {
  return REGION_MAP.get(id)?.label ?? "なし";
}

/**
 * 資産クラス変更時の地域の自動補完。
 * 現金は日本（未設定時のみ）、ゴールド・暗号資産は「なし」に揃える。
 */
export function suggestRegion(assetClass: AssetClassId, current: RegionId): RegionId {
  if (assetClass === "gold" || assetClass === "crypto") return "none";
  if (assetClass === "cash" && current === "none") return "japan";
  return current;
}

// 口座の並び順（index）に対応する表示色
export const ACCOUNT_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6"] as const;

export function accountColor(index: number): string {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
}
