"use client";

import { useState, type ReactNode } from "react";
import { CircleHelp, PiggyBank } from "lucide-react";
import { APP_VERSION, COMMIT_SHA } from "@/lib/version";
import { HelpDialog } from "@/components/HelpDialog";

interface HeaderProps {
  /** 右端に置く要素（同期メニュー） */
  right: ReactNode;
}

export function Header({ right }: HeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/30">
            <PiggyBank className="size-5" aria-hidden />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-bold tracking-[0.12em] text-slate-900">TAMERU</h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">資産を、スプレッドシート感覚で積み上げる</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5">
          {right}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="ヘルプ"
            title="ヘルプ"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-teal-700"
          >
            <CircleHelp className="size-5" aria-hidden />
          </button>
          <span
            className="text-[11px] tabular-nums text-slate-400"
            title={COMMIT_SHA ? `バージョン ${APP_VERSION}（${COMMIT_SHA}）` : `バージョン ${APP_VERSION}`}
          >
            v{APP_VERSION}
          </span>
        </div>
      </div>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </header>
  );
}
