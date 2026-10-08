"use client";

import { useMemo, useState } from "react";
import { useTameruStore } from "@/hooks/useTameruStore";
import { useCloudSync } from "@/hooks/useCloudSync";
import { SyncMenu } from "@/components/SyncMenu";
import { InitialSyncDialog } from "@/components/SyncDialogs";
import { History, X } from "lucide-react";
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
import { SiteFooterLinks } from "@/components/SiteFooterLinks";
import { WelcomeCard } from "@/components/WelcomeCard";

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
            ready={sync.ready}
            saveError={saveError}
            backup={sync.backup}
            onPrepareSignIn={sync.prepare}
            onSignIn={sync.signIn}
            onSignOut={sync.signOut}
            onDeleteAccount={sync.deleteAccount}
            onRestoreBackup={sync.restoreBackup}
          />
        }
      />
      {sync.initialChoice && <InitialSyncDialog request={sync.initialChoice} />}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* 金額がまだ1つも入力されていない（初めて使う）ときだけ紹介を出す */}
        {!summary.latest && <WelcomeCard />}
        {sync.backupNotice && (
          <BackupNotice
            message={
              sync.backupNotice.reason === "cloud-replaced"
                ? "クラウドのデータを、この端末のデータで上書きしました。"
                : "この端末のデータを、クラウドのデータに置き換えました。"
            }
            onRestore={() => {
              if (window.confirm("置き換える前のデータに戻しますか？（今のデータもバックアップされます）")) {
                sync.restoreBackup();
              }
            }}
            onClose={sync.dismissBackupNotice}
          />
        )}
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
      <footer className="space-y-2 px-4 py-6 text-center text-xs text-slate-400">
        <p>
          {sync.state.status === "signed-out"
            ? "TAMERU — データはこのブラウザ内にのみ保存され、外部に送信されません"
            : "TAMERU — ログイン中は、データを端末間で同期するためクラウド（Google Firebase・東京）に保存します"}
        </p>
        <SiteFooterLinks />
      </footer>
    </div>
  );
}

/** 同期でデータを置き換えた直後に出す案内（置き換える前のデータに戻せる） */
function BackupNotice({ message, onRestore, onClose }: { message: string; onRestore: () => void; onClose: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
      role="status"
    >
      <History className="size-4 shrink-0 text-teal-600" aria-hidden />
      <p className="min-w-0 flex-1">
        {message}
        <span className="text-teal-700/80">置き換える前のデータは、この端末にバックアップしています。</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRestore}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-teal-700 shadow-sm hover:bg-teal-100"
        >
          元に戻す
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="grid size-7 place-items-center rounded-lg text-teal-700 hover:bg-teal-100"
        >
          <X className="size-4" />
        </button>
      </div>
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
