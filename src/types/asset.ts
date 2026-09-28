/** 資産クラス（何に投資しているか）。表示名・色は src/lib/constants.ts で定義 */
export type AssetClassId = "cash" | "stock" | "fund" | "bond" | "gold" | "crypto" | "other";

/** 地域（どこに投資しているか） */
export type RegionId = "japan" | "us" | "developed" | "emerging" | "global" | "none";

/** 口座内の保有内訳。金額はこの単位で入力する */
export interface Holding {
  id: string; // 一意のID（monthlyAmounts のキー）
  memo: string; // 識別用メモ（例: オルカン, S&P500, 普通預金）
  assetClass: AssetClassId;
  region: RegionId;
}

/** 口座（例: SBI証券, 三井住友銀行）。最大6口座 */
export interface AssetAccount {
  id: string;
  name: string;
  holdings: Holding[]; // 1口座あたり最大10件
}

export interface YearlyData {
  year: number; // 対象年（例: 2026）
  // 月(1〜12)ごとの内訳別金額 map: { 1: { "hold_1": 1000000 }, 2: { ... } }
  monthlyAmounts: Record<number, Record<string, number>>;
}

export interface TameruStore {
  accounts: AssetAccount[];
  yearlyData: Record<number, YearlyData>; // 年ごとのデータマッピング
}
