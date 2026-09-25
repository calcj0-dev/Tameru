export interface AssetCategory {
  id: string; // 一意のID
  name: string; // カテゴリ名（例: SBI証券, 銀行預金, 純金積立）
}

export interface YearlyData {
  year: number; // 対象年（例: 2026）
  // 月(1〜12)ごとのカテゴリ別金額 map: { 1: { "cat_1": 1000000 }, 2: { ... } }
  monthlyAmounts: Record<number, Record<string, number>>;
}

export interface TameruStore {
  categories: AssetCategory[]; // 最大10個のカテゴリ定義
  yearlyData: Record<number, YearlyData>; // 年ごとのデータマッピング
}
