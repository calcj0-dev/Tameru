import type { AssetAccount, AssetClassId, Holding, RegionId, TameruStore } from "@/types/asset";

/** テスト用の内訳 */
export function holding(id: string, assetClass: AssetClassId = "fund", region: RegionId = "global", memo = ""): Holding {
  return { id, memo, assetClass, region };
}

/** テスト用の口座 */
export function account(id: string, name: string, holdings: Holding[]): AssetAccount {
  return { id, name, holdings };
}

/**
 * テスト用のデータ。amounts は { "2026-01": { h1: 100 } } のように「年-月」で指定する
 */
export function store(accounts: AssetAccount[], amounts: Record<string, Record<string, number>> = {}): TameruStore {
  const yearlyData: TameruStore["yearlyData"] = {};
  for (const [key, values] of Object.entries(amounts)) {
    const [y, m] = key.split("-").map(Number);
    yearlyData[y] ??= { year: y, monthlyAmounts: {} };
    yearlyData[y].monthlyAmounts[m] = values;
  }
  return { accounts, yearlyData };
}

/** 銀行（h1: 現金・日本）と SBI証券（h2: 投資信託・全世界、h3: 株式・米国）の標準データ */
export function sampleAccounts(): AssetAccount[] {
  return [
    account("a1", "銀行", [holding("h1", "cash", "japan", "普通預金")]),
    account("a2", "SBI証券", [holding("h2", "fund", "global", "オルカン"), holding("h3", "stock", "us", "米国株")]),
  ];
}
