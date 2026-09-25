"use client";

import { Minus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { Comparison, YearSummary } from "@/lib/assetCalc";
import { formatSignedPercent, formatSignedYen, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SummaryCards({ summary, year }: { summary: YearSummary; year: number }) {
  const { latest } = summary;
  return (
    <section className="grid gap-4 sm:grid-cols-3" aria-label="サマリー">
      <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white shadow-lg shadow-teal-700/20">
        <div className="flex items-center gap-2 text-sm text-teal-50/90">
          <Wallet className="size-4" aria-hidden />
          総資産
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{formatYen(summary.total)}</p>
        <p className="mt-1 text-xs text-teal-50/80">
          {latest ? `${latest.year}年${latest.month}月末時点` : `${year}年のデータは未入力です`}
        </p>
      </div>
      <ComparisonCard title="前月比" comparison={summary.monthOverMonth} emptyText="比較できる前月のデータがありません" />
      <ComparisonCard title="年初比" comparison={summary.yearToDate} emptyText="比較できる年初のデータがありません" />
    </section>
  );
}

function ComparisonCard({
  title,
  comparison,
  emptyText,
}: {
  title: string;
  comparison: Comparison | null;
  emptyText: string;
}) {
  const diff = comparison?.diff ?? 0;
  const tone = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{title}</span>
        {comparison && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              tone === "up" && "bg-emerald-50 text-emerald-700",
              tone === "down" && "bg-rose-50 text-rose-700",
              tone === "flat" && "bg-slate-100 text-slate-600",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {formatSignedPercent(comparison.rate)}
          </span>
        )}
      </div>
      {comparison ? (
        <>
          <p
            className={cn(
              "mt-2 text-2xl font-bold tracking-tight tabular-nums",
              tone === "up" && "text-emerald-600",
              tone === "down" && "text-rose-600",
              tone === "flat" && "text-slate-700",
            )}
          >
            {formatSignedYen(diff)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {comparison.base.year}年{comparison.base.month}月末 {formatYen(comparison.baseTotal)} から
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold text-slate-300">—</p>
          <p className="mt-1 text-xs text-slate-400">{emptyText}</p>
        </>
      )}
    </div>
  );
}
