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
  trendPeriod,
  type AllocationMode,
} from "@/lib/assetCalc";
import { Header } from "@/components/Header";
import { SummaryCards } from "@/components/SummaryCards";
import { AssetTable } from "@/components/AssetTable";
import { TrendChart, type TrendRange } from "@/components/TrendChart";
import { AllocationChart } from "@/components/AllocationChart";

export function TameruApp() {
  const { store, isLoaded, saveError, replaceStore } = useTameruStore();
  const sync = useCloudSync({ store, isLoaded, replaceStore });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("assetClass");
  const [trendRange, setTrendRange] = useState<TrendRange>(1);

  // new Date() はマウント後（isLoaded=true）にのみ描画へ反映されるので Hydration 差分は起きない
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // 年の切り替えは入力表だけに影響する。サマリー・推移・構成比は常に最新の値を使う
  const year = selectedYear ?? currentYear;

  const summary = useMemo(() => computeSummary(store), [store]);
  const trend = useMemo(() => {
    const { from, to } = trendPeriod(store, { year: currentYear, month: currentMonth }, trendRange);
    return buildTrendData(store, from, to);
  }, [store, currentYear, currentMonth, trendRange]);
  const allocation = useMemo(
    () =>
      summary.latest ? buildAllocationData(store, summary.latest.year, summary.latest.month, allocationMode) : [],
    [store, summary.latest, allocationMode],
  );

  if (!isLoaded) return <LoadingSkeleton />;

  return (
    <div className="flex min-h-full flex-col">
      <Header
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
        <SummaryCards summary={summary} />
        <AssetTable
          savedStore={store}
          year={year}
          currentYear={currentYear}
          onYearChange={setSelectedYear}
          highlightMonth={summary.latest?.year === year ? summary.latest.month : null}
          onSave={replaceStore}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-200/70" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}
