"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_YEAR, MIN_YEAR } from "@/lib/constants";

interface YearSwitcherProps {
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
}

/** ＜ 2026年 ＞ の年切り替え（入力表の対象年） */
export function YearSwitcher({ year, currentYear, onYearChange }: YearSwitcherProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-full border border-slate-200 bg-white shadow-sm">
        <YearButton label="前の年" disabled={year <= MIN_YEAR} onClick={() => onYearChange(year - 1)}>
          <ChevronLeft className="size-4" />
        </YearButton>
        <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-slate-800" aria-live="polite">
          {year}年
        </span>
        <YearButton label="次の年" disabled={year >= MAX_YEAR} onClick={() => onYearChange(year + 1)}>
          <ChevronRight className="size-4" />
        </YearButton>
      </div>
      {year !== currentYear && (
        <button
          type="button"
          onClick={() => onYearChange(currentYear)}
          className="rounded-full px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
        >
          今年へ
        </button>
      )}
    </div>
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
      className="grid size-8 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
