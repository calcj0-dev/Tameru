"use client";

import { useMemo, useState } from "react";
import { useTameruStore } from "@/hooks/useTameruStore";
import { useCloudSync } from "@/hooks/useCloudSync";
import { SyncMenu } from "@/components/SyncMenu";
import { InitialSyncDialog } from "@/components/InitialSyncDialog";
import {
  buildAllocationData,
  buildTrendData,
  computeSummary,
  getEarliestDataYear,
  type AllocationMode,
} from "@/lib/assetCalc";
import { Header } from "@/components/Header";
import { SummaryCards } from "@/components/SummaryCards";
import { AssetTable } from "@/components/AssetTable";
import { TrendChart, type TrendRange } from "@/components/TrendChart";
import { AllocationChart } from "@/components/AllocationChart";

export function TameruApp() {
  const { store, isLoaded, saveError, ...actions } = useTameruStore();
  const sync = useCloudSync({ store, isLoaded, replaceStore: actions.replaceStore });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("assetClass");
  const [trendRange, setTrendRange] = useState<TrendRange>(1);

  // new Date() はマウント後（isLoaded=true）にのみ描画へ反映されるので Hydration 差分は起きない
  const currentYear = new Date().getFullYear();
  const year = selectedYear ?? currentYear;

  const summary = useMemo(() => computeSummary(store, year), [store, year]);
  // 推移グラフは選択中の年を終点に、指定年数分（全期間はデータのある最古の年から）を表示
  const trend = useMemo(() => {
    const fromYear =
      trendRange === "all" ? Math.min(getEarliestDataYear(store) ?? year, year) : year - trendRange + 1;
    return buildTrendData(store, fromYear, year);
  }, [store, year, trendRange]);
  const allocation = useMemo(
    () =>
      summary.latest ? buildAllocationData(store, summary.latest.year, summary.latest.month, allocationMode) : [],
    [store, summary.latest, allocationMode],
  );

  if (!isLoaded) return <LoadingSkeleton />;

  return (
    <div className="flex min-h-full flex-col">
      <Header
        year={year}
        currentYear={currentYear}
        onYearChange={setSelectedYear}
        right={
          <SyncMenu
            state={sync.state}
            saveError={saveError}
            onSignIn={sync.signIn}
            onSignOut={sync.signOut}
            onDeleteAccount={sync.deleteAccount}
          />
        }
      />
      {sync.initialChoice && <InitialSyncDialog request={sync.initialChoice} />}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <SummaryCards summary={summary} year={year} />
        <AssetTable
          store={store}
          year={year}
          highlightMonth={summary.latest?.month ?? null}
          actions={actions}
        />
        <div className="grid gap-6 lg:grid-cols-5">
          <TrendChart data={trend} range={trendRange} onRangeChange={setTrendRange} />
          <AllocationChart
            data={allocation}
            latest={summary.latest}
            mode={allocationMode}
            onModeChange={setAllocationMode}
          />
        </div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-slate-400">
        {sync.state.status === "signed-out"
          ? "TAMERU — データはこのブラウザ内にのみ保存され、外部に送信されません"
          : "TAMERU — ログイン中は、データを端末間で同期するためクラウド（Google Firebase・東京）に保存します"}
      </footer>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-full flex-col" aria-busy="true">
      <div className="h-[61px] border-b border-slate-200/80 bg-white" />
      <div className="mx-auto w-full max-w-7xl animate-pulse space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-200/70" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}
