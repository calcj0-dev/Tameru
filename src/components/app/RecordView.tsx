"use client";

import { AssetTable } from "@/components/AssetTable";
import { useApp } from "@/components/app/AppContext";

/** 記録（月に1回、残高を入れる画面）: 年ごとの入力表 */
export function RecordView() {
  const { store, saveStore, summary, year, setYear, currentYear, unsavedChangesRef } = useApp();

  return (
    <AssetTable
      savedStore={store}
      year={year}
      currentYear={currentYear}
      onYearChange={setYear}
      highlightMonth={summary.latest?.year === year ? summary.latest.month : null}
      onSave={saveStore}
      onDirtyChange={(dirty) => {
        unsavedChangesRef.current = dirty;
      }}
    />
  );
}
