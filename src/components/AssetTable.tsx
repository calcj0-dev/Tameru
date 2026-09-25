"use client";

import { useEffect, useRef } from "react";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import type { TameruStore } from "@/types/asset";
import type { TameruActions } from "@/hooks/useTameruStore";
import { getMonthAmounts, getMonthTotal, hasMonthData, shiftMonth } from "@/lib/assetCalc";
import { MAX_CATEGORIES, MONTHS, categoryColor } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AmountCell, type NavDirection } from "@/components/AmountCell";

interface AssetTableProps {
  store: TameruStore;
  year: number;
  highlightMonth: number | null;
  actions: TameruActions;
}

export function AssetTable({ store, year, highlightMonth, actions }: AssetTableProps) {
  const { categories } = store;
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocusId = useRef<string | null>(null);
  const rowCount = categories.length;
  const canAdd = rowCount < MAX_CATEGORIES;

  // 追加したカテゴリの名前入力へフォーカス
  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    pendingFocusId.current = null;
    const el = scrollRef.current?.querySelector<HTMLInputElement>(`input[data-cat-name="${id}"]`);
    el?.focus();
  }, [categories]);

  const focusCell = (row: number, month: number) => {
    const el = scrollRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${row}-${month}"]`);
    if (!el) return false;
    el.focus();
    return true;
  };

  const navigate = (row: number, month: number, dir: NavDirection): boolean => {
    let target: [number, number] | null = null;
    switch (dir) {
      case "down":
        target = row + 1 < rowCount ? [row + 1, month] : month < 12 ? [0, month + 1] : null;
        break;
      case "up":
        target = row > 0 ? [row - 1, month] : month > 1 ? [rowCount - 1, month - 1] : null;
        break;
      case "right":
        target = month < 12 ? [row, month + 1] : row + 1 < rowCount ? [row + 1, 1] : null;
        break;
      case "left":
        target = month > 1 ? [row, month - 1] : row > 0 ? [row - 1, 12] : null;
        break;
    }
    return target ? focusCell(target[0], target[1]) : false;
  };

  const handleAdd = () => {
    if (!canAdd) return;
    pendingFocusId.current = actions.addCategory("");
  };

  const handleRemove = (id: string, name: string) => {
    const hasData = Object.values(store.yearlyData).some((yd) =>
      Object.values(yd.monthlyAmounts).some((amounts) => id in amounts),
    );
    const label = name || "このカテゴリ";
    if (hasData && !window.confirm(`「${label}」を削除します。全年度の入力データも削除されます。よろしいですか？`)) {
      return;
    }
    actions.removeCategory(id);
  };

  const handleCopy = (month: number) => {
    const prev = shiftMonth(year, month, -1);
    if (
      hasMonthData(store, year, month) &&
      !window.confirm(`${month}月の入力済みの値を、${prev.month}月の値で上書きします。よろしいですか？`)
    ) {
      return;
    }
    actions.copyPreviousMonth(year, month);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">{year}年 資産入力</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            各月末の残高を入力。<Kbd>Enter</Kbd> で下へ、<Kbd>Tab</Kbd> で右へ移動します。
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="size-4" aria-hidden />
          カテゴリ追加
          <span className="text-xs font-normal opacity-80 tabular-nums">
            {rowCount}/{MAX_CATEGORIES}
          </span>
        </button>
      </div>

      <div ref={scrollRef} className="overflow-x-auto scroll-pl-36 sm:scroll-pl-48">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th
                scope="col"
                className="sticky left-0 z-20 w-36 min-w-36 sm:w-48 sm:min-w-48 border-b border-r border-slate-200 bg-slate-50 px-4 py-2 text-left font-medium"
              >
                カテゴリ
              </th>
              {MONTHS.map((m) => {
                const prev = shiftMonth(year, m, -1);
                const canCopy = rowCount > 0 && hasMonthData(store, prev.year, prev.month);
                return (
                  <th
                    key={m}
                    scope="col"
                    className={cn(
                      "border-b border-slate-200 bg-slate-50 px-1.5 py-2 font-medium",
                      m === highlightMonth && "bg-teal-50 text-teal-800",
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm text-slate-700">{m}月</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(m)}
                        disabled={!canCopy}
                        title={canCopy ? `${prev.year}年${prev.month}月の値をコピー` : "前月のデータがありません"}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-normal text-slate-500 transition hover:bg-white hover:text-teal-700 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none"
                      >
                        <CopyPlus className="size-3" aria-hidden />
                        前月コピー
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {categories.map((c, row) => {
              const color = categoryColor(row);
              return (
                <tr key={c.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-2 py-1 text-left font-normal group-hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="ml-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                      <input
                        type="text"
                        value={c.name}
                        data-cat-name={c.id}
                        onChange={(e) => actions.renameCategory(c.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            focusCell(row, 1);
                          }
                        }}
                        placeholder="カテゴリ名"
                        aria-label={`カテゴリ名 ${row + 1}`}
                        maxLength={30}
                        className="w-full min-w-0 rounded-md bg-transparent px-1.5 py-1.5 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemove(c.id, c.name)}
                        aria-label={`${c.name || "カテゴリ"}を削除`}
                        title="削除"
                        className="grid size-7 shrink-0 place-items-center rounded-md text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 focus:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </th>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className={cn("border-b border-slate-100 px-1 py-1", m === highlightMonth && "bg-teal-50/40")}
                    >
                      <AmountCell
                        cellId={`${row}-${m}`}
                        ariaLabel={`${c.name || "カテゴリ"} ${m}月`}
                        value={getMonthAmounts(store, year, m)?.[c.id]}
                        onCommit={(v) => actions.setAmount(year, m, c.id, v)}
                        onNavigate={(dir) => navigate(row, m, dir)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}

            {rowCount === 0 && (
              <tr>
                <td colSpan={13} className="px-5 py-10 text-center text-sm text-slate-400">
                  「カテゴリ追加」から銀行口座や証券口座などを登録してください
                </td>
              </tr>
            )}
          </tbody>

          {rowCount > 0 && (
            <tfoot>
              <tr className="font-semibold text-slate-900">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm"
                >
                  合計
                </th>
                {MONTHS.map((m) => {
                  const total = getMonthTotal(store, year, m);
                  return (
                    <td
                      key={m}
                      className={cn(
                        "bg-slate-50 px-3.5 py-3 text-right tabular-nums",
                        m === highlightMonth && "bg-teal-50",
                        total === null && "font-normal text-slate-300",
                      )}
                    >
                      {total === null ? "—" : formatNumber(total)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-slate-200 bg-slate-50 px-1 py-px font-sans text-[10px] text-slate-600">
      {children}
    </kbd>
  );
}
