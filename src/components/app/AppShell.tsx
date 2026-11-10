"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { History, X } from "lucide-react";
import { useTameruStore } from "@/hooks/useTameruStore";
import { useCloudSync } from "@/hooks/useCloudSync";
import { computeSummary, type AllocationMode } from "@/lib/assetCalc";
import type { TrendRange } from "@/components/TrendChart";
import { Header } from "@/components/Header";
import { SyncMenu } from "@/components/SyncMenu";
import { InitialSyncDialog } from "@/components/SyncDialogs";
import { SiteFooterLinks } from "@/components/SiteFooterLinks";
import { SiteAbout } from "@/components/SiteAbout";
import { AppContext, type AppState } from "@/components/app/AppContext";
import { TabNav } from "@/components/app/TabNav";

/**
 * ホーム・記録の2画面に共通の枠。データ・同期・ヘッダー・タブ・画面下を持ち、その中で画面（children）だけを入れ替える。
 * タブを切り替えても、データの読み込みや Google ログインの準備はやり直さない。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { store, isLoaded, saveError, replaceStore } = useTameruStore();
  const sync = useCloudSync({ store, isLoaded, replaceStore });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("assetClass");
  const [trendRange, setTrendRange] = useState<TrendRange>(1);
  const unsavedChangesRef = useRef(false);
  const summary = useMemo(() => computeSummary(store), [store]);

  if (!isLoaded) return <LoadingShell />;

  // new Date() はマウント後（isLoaded=true）にのみ描画へ反映されるので Hydration 差分は起きない
  const now = new Date();
  const currentYear = now.getFullYear();
  const app: AppState = {
    store,
    saveStore: replaceStore,
    summary,
    currentYear,
    currentMonth: now.getMonth() + 1,
    year: selectedYear ?? currentYear,
    setYear: setSelectedYear,
    trendRange,
    setTrendRange,
    allocationMode,
    setAllocationMode,
    unsavedChangesRef,
  };

  return (
    <AppContext.Provider value={app}>
      <Frame
        header={
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
        unsavedChangesRef={unsavedChangesRef}
        footerNote={
          sync.state.status === "signed-out"
            ? "TAMERU — データはこのブラウザ内にのみ保存され、外部に送信されません"
            : "TAMERU — ログイン中は、データを端末間で同期するためクラウド（Google Firebase・東京）に保存します"
        }
      >
        {sync.initialChoice && <InitialSyncDialog request={sync.initialChoice} />}
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
        {children}
      </Frame>
    </AppContext.Provider>
  );
}

/** ヘッダー・タブ・本文・画面下の配置 */
function Frame({
  header,
  unsavedChangesRef,
  footerNote,
  children,
}: {
  header: ReactNode;
  unsavedChangesRef?: AppState["unsavedChangesRef"];
  footerNote?: string;
  children: ReactNode;
}) {
  return (
    // スマホでは画面の下にタブが固定されるので、その分の余白を空ける
    <div className="flex min-h-full flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <Header right={header} />
      <TabNav unsavedChangesRef={unsavedChangesRef} />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">{children}</main>
      <footer className="space-y-4 px-4 py-6 text-center text-xs text-slate-400">
        <SiteAbout />
        {footerNote && <p>{footerNote}</p>}
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

/**
 * データの読み込み中の表示。ヘッダー・タブ・紹介文・リンクは、読み込み前から HTML に含めておく
 * （検索エンジンや、表示が遅い端末でも何のサイトか分かるように）
 */
function LoadingShell() {
  return (
    <Frame header={null}>
      <div className="animate-pulse space-y-6" aria-busy="true" aria-label="読み込み中">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-200/70" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-200/70" />
      </div>
    </Frame>
  );
}
