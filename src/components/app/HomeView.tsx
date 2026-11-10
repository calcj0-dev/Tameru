"use client";

import { useMemo } from "react";
import { buildAllocationData, buildTrendData, trendPeriod } from "@/lib/assetCalc";
import { SummaryCards } from "@/components/SummaryCards";
import { TrendChart } from "@/components/TrendChart";
import { AllocationChart } from "@/components/AllocationChart";
import { WelcomeCard } from "@/components/WelcomeCard";
import { useApp } from "@/components/app/AppContext";

/** ホーム（眺める画面）: サマリー・資産推移・ポートフォリオ構成比 */
export function HomeView() {
  const { store, summary, currentYear, currentMonth, trendRange, setTrendRange, allocationMode, setAllocationMode } =
    useApp();

  const trend = useMemo(() => {
    const { from, to } = trendPeriod(store, { year: currentYear, month: currentMonth }, trendRange);
    return buildTrendData(store, from, to);
  }, [store, currentYear, currentMonth, trendRange]);
  const allocation = useMemo(
    () =>
      summary.latest ? buildAllocationData(store, summary.latest.year, summary.latest.month, allocationMode) : [],
    [store, summary.latest, allocationMode],
  );

  return (
    <>
      {/* 金額がまだ1つも入力されていない（初めて使う）ときだけ紹介を出す */}
      {!summary.latest && <WelcomeCard />}
      <SummaryCards summary={summary} />
      <div className="grid gap-6 lg:grid-cols-5">
        <TrendChart data={trend} range={trendRange} onRangeChange={setTrendRange} />
        <AllocationChart
          data={allocation}
          latest={summary.latest}
          mode={allocationMode}
          onModeChange={setAllocationMode}
        />
      </div>
    </>
  );
}
