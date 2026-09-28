"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { TrendPoint } from "@/lib/assetCalc";
import { formatCompactYen, formatSignedPercent, formatSignedYen, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

const LINE_COLOR = "#0d9488"; // teal-600
const GRID_COLOR = "#eef2f6";
const TICK_COLOR = "#94a3b8"; // slate-400

export function TrendChart({ data, year }: { data: TrendPoint[]; year: number }) {
  const gradientId = useId();
  const values = data.flatMap((d) => (d.total !== null && Number.isFinite(d.total) ? [d.total] : []));
  const hasData = values.length > 0;
  const { domain, ticks } = yAxisScale(values);
  const lastIndex = findLastIndex(data, (d) => d.total !== null);

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
      <h2 className="font-semibold text-slate-900">{year}年 資産推移</h2>
      <p className="mt-0.5 text-xs text-slate-500">各月末時点の総資産</p>

      <div className="relative -mx-1 mt-4 h-72">
        {!hasData && <EmptyOverlay />}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 32, right: 16, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.22} />
                <stop offset="70%" stopColor={LINE_COLOR} stopOpacity={0.04} />
                <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: TICK_COLOR }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="equidistantPreserveStart"
              minTickGap={4}
            />
            <YAxis
              tickFormatter={(v: number) => formatCompactYen(v)}
              tick={{ fontSize: 11, fill: TICK_COLOR }}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={52}
              ticks={ticks}
              domain={domain}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              content={({ active, payload }) => (
                <TrendTooltip active={active} point={payload?.[0]?.payload as TrendPoint | undefined} year={year} />
              )}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={LINE_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${gradientId})`}
              connectNulls
              dot={(props: DotProps) => <EndDot key={props.index} {...props} lastIndex={lastIndex} />}
              activeDot={{ r: 5, fill: LINE_COLOR, stroke: "#fff", strokeWidth: 2 }}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: TrendPoint;
}

/** 最新月のみ、点（白い縁取り＋淡い光彩）と金額ラベルを描く */
function EndDot({ cx, cy, index, payload, lastIndex }: DotProps & { lastIndex: number }) {
  // Area の value は [下端, 上端] の配列になるため、元データ（payload）から値を取る
  const value = payload?.total;
  if (index !== lastIndex || cx === undefined || cy === undefined || typeof value !== "number") {
    return <g />;
  }
  // 端に近いときはラベルがはみ出さないよう寄せる
  const anchor = index >= 10 ? "end" : index <= 1 ? "start" : "middle";
  const dx = anchor === "end" ? 6 : anchor === "start" ? -6 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={LINE_COLOR} opacity={0.14} />
      <circle cx={cx} cy={cy} r={5} fill={LINE_COLOR} stroke="#fff" strokeWidth={2} />
      <text
        x={cx + dx}
        y={cy - 16}
        textAnchor={anchor}
        fontSize={12}
        fontWeight={600}
        fill="#0f172a"
        className="tabular-nums"
      >
        {formatCompactYen(value)}
      </text>
    </g>
  );
}

function TrendTooltip({ active, point, year }: { active?: boolean; point?: TrendPoint; year: number }) {
  if (!active || !point) return null;
  const change = point.change;
  const tone = !change ? "flat" : change.diff > 0 ? "up" : change.diff < 0 ? "down" : "flat";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;

  return (
    <div className="min-w-44 rounded-xl bg-slate-900/95 px-3.5 py-2.5 text-white shadow-xl shadow-slate-900/20 backdrop-blur">
      <p className="text-[11px] text-slate-400">
        {year}年{point.month}月末
      </p>
      {point.total === null ? (
        <p className="mt-0.5 text-sm text-slate-400">未入力</p>
      ) : (
        <>
          <p className="mt-0.5 text-base font-semibold tabular-nums">{formatYen(point.total)}</p>
          {change && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs tabular-nums",
                tone === "up" && "text-emerald-400",
                tone === "down" && "text-rose-400",
                tone === "flat" && "text-slate-400",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              前月比 {formatSignedYen(change.diff)}（{formatSignedPercent(change.rate)}）
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Y軸の範囲と目盛り。キリの良い間隔（1・2・2.5・5 × 10^n）で4区間前後に揃える。
 * 値が1点だけ・全月同額の場合でも目盛りが重複しないよう上下に余白を取る。
 */
function yAxisScale(values: number[]): { domain: [number, number]; ticks: number[] | undefined } {
  if (values.length === 0) return { domain: [0, 1], ticks: undefined };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.1, Math.abs(max) * 0.05, 10_000);
  const lo = min >= 0 ? Math.max(0, min - pad) : min - pad;
  const hi = max + pad;

  const rawStep = (hi - lo) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return { domain: [start, end], ticks };
}

function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

function EmptyOverlay() {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center text-sm text-slate-400">
      データを入力するとグラフが表示されます
    </div>
  );
}
