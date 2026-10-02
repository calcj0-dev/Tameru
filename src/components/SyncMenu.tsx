"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudOff,
  HardDrive,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { SyncState, SyncStatus } from "@/lib/sync/cloudSync";
import { cn } from "@/lib/utils";

interface SyncMenuProps {
  state: SyncState;
  saveError: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
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

/**
 * ヘッダー右端の同期メニュー。
 * 未ログイン: 「Google でログイン」ボタン / ログイン中: 同期状態アイコン → メニュー
 */
export function SyncMenu({ state, saveError, onSignIn, onSignOut, onDeleteAccount }: SyncMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

  const signedIn = state.email !== null && state.status !== "signed-out";
  const s = saveError ? { label: "保存エラー", icon: TriangleAlert, tone: "error" as const } : STATUS[state.status];
  const Icon = s.icon;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "処理に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn && state.status !== "connecting") {
    return (
      <div className="flex items-center gap-2">
        {saveError && (
          <span className="flex items-center text-rose-600" role="alert" title="この端末への保存に失敗しました">
            <TriangleAlert className="size-4" />
          </span>
        )}
        <button
          type="button"
          onClick={() => void run(onSignIn)}
          disabled={busy}
          title="Google アカウントでログインすると、PC とスマホでデータを自動同期できます"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
          <span className="hidden sm:inline">Google でログイン</span>
          <span className="sm:hidden">ログイン</span>
        </button>
        {state.error && (
          <span className="hidden max-w-48 text-[11px] leading-tight text-rose-600 md:block" role="alert">
            {state.error}
          </span>
        )}
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
        <span className="hidden sm:inline">{s.label}</span>
        <span className="sr-only sm:hidden">{s.label}</span>
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

          <MenuItem icon={LogOut} disabled={busy} onClick={() => void run(onSignOut)}>
            ログアウト
            <span className="block text-[11px] font-normal text-slate-400">この端末のデータは残ります</span>
          </MenuItem>
          <MenuItem
            icon={Trash2}
            danger
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "クラウドに保存されたデータと、TAMERU のアカウントを削除します。\n（この端末のデータは残ります）\nよろしいですか？",
                )
              ) {
                void run(onDeleteAccount);
              }
            }}
          >
            クラウドのデータとアカウントを削除
          </MenuItem>
          {message && <p className="px-2.5 pb-1.5 pt-1 text-xs text-rose-600">{message}</p>}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  disabled,
  onClick,
  children,
}: {
  icon: typeof Cloud;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:opacity-50",
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
