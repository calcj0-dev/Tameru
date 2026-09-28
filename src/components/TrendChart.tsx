"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/assetCalc";
import { formatCompactYen, formatYen } from "@/lib/format";

export function TrendChart({ data, year }: { data: TrendPoint[]; year: number }) {
  const values = data.flatMap((d) => (d.total !== null && Number.isFinite(d.total) ? [d.total] : []));
  const hasData = values.length > 0;
  const domain = yDomain(values);

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
      <h2 className="font-semibold text-slate-900">{year}年 資産推移</h2>
      <p className="mt-0.5 text-xs text-slate-500">各月末時点の総資産</p>
      <div className="relative mt-4 h-72">
        {!hasData && <EmptyOverlay />}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => formatCompactYen(v)}
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={domain}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "#99f6e4", strokeWidth: 2 }}
              formatter={(value) => [formatYen(Number(value) || 0), "総資産"]}
              labelFormatter={(label) => `${year}年${label}末`}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#0d9488"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "#0d9488", strokeWidth: 0 }}
              activeDot={{ r: 5.5, stroke: "#fff", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Y軸の範囲。値が1点だけ・全月同額の場合でも目盛りが重複しないよう上下に余白を取る。
 */
function yDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.1, Math.abs(max) * 0.05, 10_000);
  const lower = min >= 0 ? Math.max(0, min - pad) : min - pad;
  return [Math.floor(lower), Math.ceil(max + pad)];
}

function EmptyOverlay() {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center text-sm text-slate-400">
      データを入力するとグラフが表示されます
    </div>
  );
}
