"use client";

import { createContext, useContext, type RefObject } from "react";
import type { TameruStore } from "@/types/asset";
import type { AllocationMode, YearSummary } from "@/lib/assetCalc";
import type { TrendRange } from "@/components/TrendChart";

/**
 * ホーム・記録の2画面で共有する状態。
 * 画面を切り替えても、データ・選んだ年・グラフの表示期間などが保たれるように、共通の枠（AppShell）が持つ。
 */
export interface AppState {
  store: TameruStore;
  /** 編集の「保存」で、データを置き換える */
  saveStore: (store: TameruStore) => void;
  summary: YearSummary;
  /** 今日の年月（データの読み込み後にだけ使うので、Hydration 差分は起きない） */
  currentYear: number;
  currentMonth: number;
  /** 記録の画面で表示している年 */
  year: number;
  setYear: (year: number) => void;
  trendRange: TrendRange;
  setTrendRange: (range: TrendRange) => void;
  allocationMode: AllocationMode;
  setAllocationMode: (mode: AllocationMode) => void;
  /** 記録の画面で、保存していない変更があるか（タブで画面を移るときの確認に使う） */
  unsavedChangesRef: RefObject<boolean>;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const app = useContext(AppContext);
  if (!app) throw new Error("useApp は AppShell の中で使う");
  return app;
}
