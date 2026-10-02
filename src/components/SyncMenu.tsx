"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudOff,
  History,
  HardDrive,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { SyncState, SyncStatus } from "@/lib/sync/cloudSync";
import { describeBackup, type SyncBackup } from "@/lib/sync/backup";
import { cn } from "@/lib/utils";
import { DeleteCloudDialog, LoginIntroDialog, LogoutDialog, RestoreBackupDialog } from "@/components/SyncDialogs";

interface SyncMenuProps {
  state: SyncState;
  /** ログインの準備（Firebase の読み込み）が終わったか */
  ready: boolean;
  saveError: boolean;
  /** 同期で置き換える前のバックアップ（あれば「バックアップから戻す」を表示） */
  backup: SyncBackup | null;
  /** ログインの準備（Firebase の読み込み）を先に始める */
  onPrepareSignIn: () => void;
  onSignIn: () => Promise<void>;
  onSignOut: (options: { clearLocal: boolean }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onRestoreBackup: () => void;
}

const STATUS: Record<SyncStatus, { label: string; icon: typeof Cloud; tone: "muted" | "ok" | "busy" | "warn" | "error" }> = {
  "signed-out": { label: "この端末のみ", icon: HardDrive, tone: "muted" },
  connecting: { label: "接続中", icon: LoaderCircle, tone: "busy" },
  syncing: { label: "同期中", icon: RefreshCw, tone: "busy" },
  synced: { label: "同期済み", icon: CloudCheck, tone: "ok" },
  offline: { label: "オフライン", icon: CloudOff, tone: "warn" },
  error: { label: "同期エラー", icon: CloudAlert, tone: "error" },
  outdated: { label: "更新が必要", icon: TriangleAlert, tone: "error" },
};

type DialogKind = "login" | "logout" | "delete" | "restore" | null;

/**
 * ヘッダー右端の同期メニュー。
 * 未ログイン: 「Google でログイン」→ 説明画面 → ログイン / ログイン中: 同期状態 → メニュー
 * データが消える可能性がある操作は、必ず説明・確認の画面を挟む。
 */
export function SyncMenu({
  state,
  ready,
  saveError,
  backup,
  onPrepareSignIn,
  onSignIn,
  onSignOut,
  onDeleteAccount,
  onRestoreBackup,
}: SyncMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openDialog = (kind: DialogKind) => {
    setOpen(false);
    setDialog(kind);
  };
  const closeDialog = () => setDialog(null);

  const signedIn = state.email !== null && state.status !== "signed-out";
  const s = saveError ? { label: "保存エラー", icon: TriangleAlert, tone: "error" as const } : STATUS[state.status];
  // ボタンには、正常に同期できているときは「ログイン済み」と表示する（問題があるときだけ状態を表示）。
  // メニュー内には詳しい状態（同期済み・時刻）を表示する
  const buttonLabel = !saveError && state.status === "synced" ? "ログイン済み" : s.label;
  const Icon = s.icon;

  const dialogs = (
    <>
      {dialog === "login" && <LoginIntroDialog ready={ready} onLogin={onSignIn} onClose={closeDialog} />}
      {dialog === "logout" && (
        <LogoutDialog email={state.email} onLogout={(clearLocal) => onSignOut({ clearLocal })} onClose={closeDialog} />
      )}
      {dialog === "delete" && <DeleteCloudDialog onDelete={onDeleteAccount} onClose={closeDialog} />}
      {dialog === "restore" && backup && (
        <RestoreBackupDialog backup={backup} onRestore={onRestoreBackup} onClose={closeDialog} />
      )}
    </>
  );

  if (!signedIn && state.status !== "connecting") {
    return (
      <div className="relative flex items-center gap-2">
        {saveError && (
          <span className="flex items-center text-rose-600" role="alert" title="この端末への保存に失敗しました">
            <TriangleAlert className="size-4" />
          </span>
        )}
        <button
          type="button"
          onPointerDown={onPrepareSignIn}
          onFocus={onPrepareSignIn}
          onClick={() => {
            onPrepareSignIn();
            setDialog("login");
          }}
          title="Google アカウントでログインすると、PC とスマホでデータを自動同期できます"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700"
        >
          <LogIn className="size-3.5" />
          <span className="hidden sm:inline">Google でログイン</span>
          <span className="sm:hidden">ログイン</span>
        </button>
        {state.error && (
          // スマホ: ボタンの下に吹き出しで表示 / PC: ボタンの横に表示
          <span
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-700 shadow-md md:static md:mt-0 md:w-auto md:max-w-48 md:border-0 md:bg-transparent md:p-0 md:text-[11px] md:leading-tight md:text-rose-600 md:shadow-none"
            role="alert"
          >
            {state.error}
          </span>
        )}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm transition",
          s.tone === "ok" && "border-slate-200 text-teal-700",
          s.tone === "muted" && "border-slate-200 text-slate-600",
          s.tone === "busy" && "border-slate-200 text-slate-600",
          s.tone === "warn" && "border-amber-200 text-amber-700",
          s.tone === "error" && "border-rose-200 text-rose-600",
        )}
      >
        <Icon className={cn("size-4", s.tone === "busy" && "animate-spin")} aria-hidden />
        <span className="hidden sm:inline">{buttonLabel}</span>
        <span className="sr-only sm:hidden">{buttonLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl"
        >
          <div className="border-b border-slate-100 px-2.5 pb-2.5 pt-1.5">
            <p className="text-[11px] text-slate-500">ログイン中</p>
            <p className="truncate font-medium text-slate-900">{state.email}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
              <Icon className={cn("size-3.5", s.tone === "busy" && "animate-spin")} aria-hidden />
              {s.label}
              {state.syncedAt && state.status === "synced" && (
                <span className="text-slate-400">・{formatTime(state.syncedAt)}</span>
              )}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              この Google アカウントでログインした端末どうしで、データが自動で同期されます。
            </p>
            {state.status === "offline" && (
              <p className="mt-1 text-xs text-slate-500">オンラインになると自動で同期します。入力はこの端末に保存されています。</p>
            )}
            {state.error && state.status === "error" && <p className="mt-1 text-xs text-rose-600">{state.error}</p>}
            {state.status === "outdated" && (
              <div className="mt-1.5 space-y-1.5">
                <p className="text-xs text-rose-600">
                  新しいバージョンのアプリで保存されたデータがあります。データを守るため、このアプリからの同期を停止しています。
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700"
                >
                  <RefreshCw className="size-3.5" /> アプリを更新
                </button>
              </div>
            )}
          </div>

          {backup && (
            <MenuItem icon={History} onClick={() => openDialog("restore")}>
              バックアップから戻す
              <span className="block text-[11px] font-normal text-slate-400">{describeBackup(backup)}</span>
            </MenuItem>
          )}
          <MenuItem icon={LogOut} onClick={() => openDialog("logout")}>
            ログアウト…
            <span className="block text-[11px] font-normal text-slate-400">クラウドのデータは残ります</span>
          </MenuItem>
          <MenuItem icon={Trash2} danger onClick={() => openDialog("delete")}>
            同期をやめて、クラウドのデータを削除…
            <span className="block text-[11px] font-normal text-rose-400">Google アカウントは削除されません</span>
          </MenuItem>
        </div>
      )}
      {dialogs}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  onClick,
  children,
}: {
  icon: typeof Cloud;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
        danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
