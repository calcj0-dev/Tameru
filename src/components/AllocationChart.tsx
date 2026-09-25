"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationSlice, YearMonth } from "@/lib/assetCalc";
import { formatCompactYen, formatYen } from "@/lib/format";

export function AllocationChart({ data, latest }: { data: AllocationSlice[]; latest: YearMonth | null }) {
  const total = data.reduce((acc, s) => acc + s.value, 0);
  const chartData = data.map((s) => ({ ...s, fill: s.color }));

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <h2 className="font-semibold text-slate-900">ポートフォリオ構成比</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        {latest ? `${latest.year}年${latest.month}月末時点` : "最新月のデータがありません"}
      </p>

      {data.length === 0 ? (
        <div className="grid h-72 place-items-center text-sm text-slate-400">データを入力すると構成比が表示されます</div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
          <div className="relative size-48 shrink-0">
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
                  formatter={(value, name) => [formatYen(Number(value) || 0), name]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[11px] text-slate-500">合計</p>
                <p className="text-base font-bold tabular-nums text-slate-900">{formatCompactYen(total)}</p>
              </div>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-2">
            {data.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-slate-700" title={s.name}>
                  {s.name}
                </span>
                <span className="tabular-nums text-slate-500">{formatYen(s.value)}</span>
                <span className="w-14 text-right font-semibold tabular-nums text-slate-900">
                  {(s.ratio * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
