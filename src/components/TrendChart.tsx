"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { TrendPoint } from "@/lib/assetCalc";
import { formatCompactYen, formatSignedPercent, formatSignedYen, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartPanel } from "@/components/ChartPanel";
import { SegmentedControl } from "@/components/SegmentedControl";

export type TrendRange = 1 | 2 | 3 | 5 | "all";

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: 1, label: "1年" },
  { value: 2, label: "2年" },
  { value: 3, label: "3年" },
  { value: 5, label: "5年" },
  { value: "all", label: "全期間" },
];

const LINE_COLOR = "#0d9488"; // teal-600
const GRID_COLOR = "#eef2f6";
const TICK_COLOR = "#94a3b8"; // slate-400

interface TrendChartProps {
  data: TrendPoint[];
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
}

export function TrendChart({ data, range, onRangeChange }: TrendChartProps) {
  const first = data[0];
  const last = data[data.length - 1];
  const period =
    first && last
      ? first.year === last.year
        ? `${first.year}年1月〜12月`
        : `${first.year}年1月〜${last.year}年12月`
      : "";

  return (
    <ChartPanel
      title="資産推移"
      subtitle={`${period}・各月末時点の総資産`}
      captureLabel="資産推移"
      className="lg:col-span-3"
      controls={
        <SegmentedControl value={range} options={RANGE_OPTIONS} onChange={onRangeChange} ariaLabel="表示期間" />
      }
    >
      {(expanded) => <TrendPlot data={data} expanded={expanded} />}
    </ChartPanel>
  );
}

function TrendPlot({ data, expanded }: { data: TrendPoint[]; expanded: boolean }) {
  // useId の値には記号が含まれるため、SVG の url(#id) で使えるよう英数字だけにする
  const gradientId = `trend-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const values = data.flatMap((d) => (d.total !== null && Number.isFinite(d.total) ? [d.total] : []));
  const hasData = values.length > 0;
  const { domain, ticks } = yAxisScale(values);
  const lastIndex = findLastIndex(data, (d) => d.total !== null);
  const xAxis = xAxisConfig(data);

  return (
    <div className={cn("relative -mx-1 mt-4", expanded ? "h-[65vh] min-h-80" : "h-72")}>
      {!hasData && <EmptyOverlay />}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 32, right: 20, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.22} />
              <stop offset="70%" stopColor={LINE_COLOR} stopOpacity={0.04} />
              <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="key"
            ticks={xAxis.ticks}
            tickFormatter={xAxis.format}
            interval={xAxis.ticks ? 0 : "equidistantPreserveStart"}
            tick={{ fontSize: expanded ? 12 : 11, fill: TICK_COLOR }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={4}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactYen(v)}
            tick={{ fontSize: expanded ? 12 : 11, fill: TICK_COLOR }}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            width={56}
            ticks={ticks}
            domain={domain}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
            content={({ active, payload }) => (
              <TrendTooltip active={active} point={payload?.[0]?.payload as TrendPoint | undefined} />
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
            dot={(props: DotProps) => (
              <EndDot key={props.index} {...props} lastIndex={lastIndex} pointCount={data.length} />
            )}
            activeDot={{ r: 5, fill: LINE_COLOR, stroke: "#fff", strokeWidth: 2 }}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * X軸の目盛り。1年表示は各月、複数年は各年の1月（2年以内は7月も）に目盛りを置く。
 * 年数が多い場合は間引く。
 */
function xAxisConfig(data: TrendPoint[]): { ticks: string[] | undefined; format: (key: string) => string } {
  const byKey = new Map(data.map((d) => [d.key, d]));
  const years = data.length / 12;
  if (years <= 1) {
    return { ticks: undefined, format: (key) => `${byKey.get(key)?.month ?? ""}月` };
  }
  const yearStep = Math.max(1, Math.ceil(years / 8));
  const firstYear = data[0]?.year ?? 0;
  const ticks = data
    .filter((d) => (d.month === 1 && (d.year - firstYear) % yearStep === 0) || (years <= 2 && d.month === 7))
    .map((d) => d.key);
  return {
    ticks,
    format: (key) => {
      const p = byKey.get(key);
      if (!p) return "";
      return p.month === 1 ? `${p.year}年` : `${p.month}月`;
    },
  };
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: TrendPoint;
}

/** 最新月のみ、点（白い縁取り＋淡い光彩）と金額ラベルを描く */
function EndDot({ cx, cy, index, payload, lastIndex, pointCount }: DotProps & { lastIndex: number; pointCount: number }) {
  // Area の value は [下端, 上端] の配列になるため、元データ（payload）から値を取る
  const value = payload?.total;
  if (index === undefined || index !== lastIndex || cx === undefined || cy === undefined || typeof value !== "number") {
    return <g />;
  }
  // 端に近いときはラベルがはみ出さないよう寄せる
  const position = index / Math.max(1, pointCount - 1);
  const anchor = position > 0.85 ? "end" : position < 0.1 ? "start" : "middle";
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
        // 線と重なっても読めるよう白い縁取りを付ける
        stroke="#ffffff"
        strokeWidth={4}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {formatCompactYen(value)}
      </text>
    </g>
  );
}

function TrendTooltip({ active, point }: { active?: boolean; point?: TrendPoint }) {
  if (!active || !point) return null;
  const change = point.change;
  const tone = !change ? "flat" : change.diff > 0 ? "up" : change.diff < 0 ? "down" : "flat";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;

  return (
    <div className="min-w-44 rounded-xl bg-slate-900/95 px-3.5 py-2.5 text-white shadow-xl shadow-slate-900/20 backdrop-blur">
      <p className="text-[11px] text-slate-400">
        {point.year}年{point.month}月末
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
