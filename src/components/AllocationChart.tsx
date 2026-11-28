"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationMode, AllocationSlice, YearMonth } from "@/lib/assetCalc";
import { useAmounts, useAmountVisibility } from "@/lib/amountVisibility";
import { cn } from "@/lib/utils";
import { ChartPanel, type PlotMode } from "@/components/ChartPanel";
import { SegmentedControl } from "@/components/SegmentedControl";

const MODES: { value: AllocationMode; label: string }[] = [
  { value: "assetClass", label: "資産クラス" },
  { value: "region", label: "地域" },
  { value: "account", label: "口座" },
];

const MODE_LABEL: Record<AllocationMode, string> = {
  assetClass: "資産クラス別",
  region: "地域別",
  account: "口座別",
};

export function AllocationChart({
  data,
  latest,
  mode,
  onModeChange,
}: {
  data: AllocationSlice[];
  latest: YearMonth | null;
  mode: AllocationMode;
  onModeChange: (mode: AllocationMode) => void;
}) {
  return (
    <ChartPanel
      title="ポートフォリオ構成比"
      subtitle={
        latest ? `${latest.year}年${latest.month}月時点・${MODE_LABEL[mode]}` : "最新月のデータがありません"
      }
      captureLabel={`ポートフォリオ構成比-${MODE_LABEL[mode]}`}
      className="lg:col-span-2"
      controls={<SegmentedControl value={mode} options={MODES} onChange={onModeChange} ariaLabel="集計単位" />}
    >
      {(mode) => <AllocationPlot data={data} mode={mode} />}
    </ChartPanel>
  );
}

function AllocationPlot({ data, mode }: { data: AllocationSlice[]; mode: PlotMode }) {
  const expanded = mode !== "card";
  const capture = mode === "capture";
  const total = data.reduce((acc, s) => acc + s.value, 0);
  const amounts = useAmounts();
  const { hidden } = useAmountVisibility();
  const chartData = data.map((s) => ({ ...s, fill: s.color }));

  if (data.length === 0) {
    return (
      <div className={cn("grid place-items-center text-sm text-slate-400", capture ? "flex-1" : expanded ? "h-[50vh]" : "h-72")}>
        データを入力すると構成比が表示されます
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-4 flex flex-col items-center",
        capture
          ? "min-h-0 flex-1 flex-row justify-center gap-20"
          : expanded
            ? "gap-8 py-4 md:flex-row md:justify-center md:gap-14"
            : "gap-5 sm:flex-row lg:flex-col xl:flex-row",
      )}
    >
      <div className={cn("relative shrink-0", capture ? "size-[400px]" : expanded ? "size-72 sm:size-96" : "size-48")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 1.5 : 0}
              stroke="none"
              isAnimationActive={false}
            />
            <Tooltip
              formatter={(value, name, item) =>
                // 金額を隠しているときは、金額の代わりに割合を出す
                [
                  hidden
                    ? `${(((item?.payload as AllocationSlice | undefined)?.ratio ?? 0) * 100).toFixed(1)}%`
                    : amounts.yen(Number(value) || 0),
                  name,
                ]
              }
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className={cn("text-slate-500", capture ? "text-lg" : expanded ? "text-sm" : "text-[11px]")}>合計</p>
            <p className={cn("font-bold tabular-nums text-slate-900", capture ? "text-4xl" : expanded ? "text-2xl" : "text-base")}>
              {expanded ? amounts.yen(total) : amounts.compactYen(total)}
            </p>
          </div>
        </div>
      </div>

      <ul className={cn("w-full min-w-0", capture ? "max-w-xl space-y-5" : expanded ? "max-w-md space-y-3" : "space-y-2")}>
        {data.map((s) => (
          <li key={s.id} className={cn("flex items-center gap-2", capture ? "gap-3 text-2xl" : expanded ? "text-base" : "text-sm")}>
            <span
              className={cn("shrink-0 rounded-full", capture ? "size-4" : expanded ? "size-3" : "size-2.5")}
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 break-words leading-snug text-slate-700">
              {s.name}
            </span>
            <span className="tabular-nums text-slate-500">{amounts.yen(s.value)}</span>
            <span className={cn("text-right font-semibold tabular-nums text-slate-900", capture ? "w-24" : expanded ? "w-16" : "w-14")}>
              {(s.ratio * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
