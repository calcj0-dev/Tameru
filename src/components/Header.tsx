"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { MAX_YEAR, MIN_YEAR } from "@/lib/constants";

interface HeaderProps {
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
  /** 右端に置く要素（同期メニュー） */
  right: ReactNode;
}

export function Header({ year, currentYear, onYearChange, right }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/30">
            <PiggyBank className="size-5" aria-hidden />
          </div>
          <div className="hidden leading-tight min-[440px]:block">
            <h1 className="text-lg font-bold tracking-[0.12em] text-slate-900">TAMERU</h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">資産を、スプレッドシート感覚で積み上げる</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {year !== currentYear && (
            <button
              type="button"
              onClick={() => onYearChange(currentYear)}
              className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 sm:block"
            >
              今年へ
            </button>
          )}
          <div className="flex items-center rounded-full border border-slate-200 bg-white shadow-sm">
            <YearButton label="前の年" disabled={year <= MIN_YEAR} onClick={() => onYearChange(year - 1)}>
              <ChevronLeft className="size-4" />
            </YearButton>
            <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-slate-800 sm:min-w-[5.5rem]" aria-live="polite">
              {year}年
            </span>
            <YearButton label="次の年" disabled={year >= MAX_YEAR} onClick={() => onYearChange(year + 1)}>
              <ChevronRight className="size-4" />
            </YearButton>
          </div>
        </div>

        <div className="flex justify-end">{right}</div>
      </div>
    </header>
  );
}

function YearButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
