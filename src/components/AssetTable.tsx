"use client";

import { Fragment, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CopyPlus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { AssetAccount, AssetClassId, Holding, RegionId, TameruStore } from "@/types/asset";
import { createEditActions } from "@/lib/storeActions";
import { applyEditAction, fillEmptyWithZero, type EditAction } from "@/lib/storeReducer";
import { getAccountMonthTotal, getMonthAmounts, getMonthTotal, hasMonthData, shiftMonth } from "@/lib/assetCalc";
import { ASSET_CLASSES, MAX_ACCOUNTS, MAX_HOLDINGS_PER_ACCOUNT, MONTHS, REGIONS, accountColor } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AmountCell, type NavDirection } from "@/components/AmountCell";
import { YearSwitcher } from "@/components/YearSwitcher";

interface AssetTableProps {
  /** 保存済みのデータ */
  savedStore: TameruStore;
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
  highlightMonth: number | null;
  /** 「保存」時に、空欄を0で埋めたデータを渡す */
  onSave: (store: TameruStore) => void;
}

type PendingFocus = { kind: "account" | "holding"; id: string };

const STICKY_COL = "sticky left-0 w-52 min-w-52 sm:w-72 sm:min-w-72";

const DISCARD_MESSAGE = "保存していない変更があります。変更を破棄しますか？";

interface DraftState {
  draft: TameruStore | null;
  dirty: boolean;
}

type DraftAction = { type: "start"; store: TameruStore } | { type: "stop" } | { type: "edit"; action: EditAction };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "start":
      return { draft: action.store, dirty: false };
    case "stop":
      return { draft: null, dirty: false };
    case "edit": {
      if (!state.draft) return state;
      const next = applyEditAction(state.draft, action.action);
      return next === state.draft ? state : { draft: next, dirty: true };
    }
  }
}

/**
 * 資産入力表。
 * - 参照のみ（既定）: 保存済みのデータを表示するだけ。「編集」ボタンで編集を開始
 * - 編集: 保存済みデータのコピー（下書き）を編集し、「保存」で反映する。「キャンセル」で破棄。どちらも参照のみに戻る
 */
export function AssetTable({ savedStore, year, currentYear, onYearChange, highlightMonth, onSave }: AssetTableProps) {
  // 下書き。draft=null は参照のみ。開くたびに参照のみから始める（状態は保存しない）
  const [{ draft, dirty }, dispatchDraft] = useReducer(draftReducer, { draft: null, dirty: false });
  const actions = useMemo(
    () => createEditActions((action) => dispatchDraft({ type: "edit", action })),
    [dispatchDraft],
  );
  const editing = draft !== null;
  const store = draft ?? savedStore;

  const handleStartEditing = () => dispatchDraft({ type: "start", store: savedStore });
  const handleCancel = () => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return;
    dispatchDraft({ type: "stop" });
  };
  // 入力欄の確定（blur）は保存ボタンのクリックより先に処理・再描画されるため、ここでの draft は最新
  const handleSave = () => {
    if (!draft) return;
    onSave(fillEmptyWithZero(draft));
    dispatchDraft({ type: "stop" });
  };

  const { accounts } = store;
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const canAddAccount = accounts.length < MAX_ACCOUNTS;

  // キーボード移動の対象（折りたたまれていない口座の内訳のみ、表示順）
  const navOrder = useMemo(
    () => accounts.filter((a) => !collapsed.has(a.id)).flatMap((a) => a.holdings.map((h) => h.id)),
    [accounts, collapsed],
  );

  // 追加した口座・内訳の入力欄へフォーカス
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const selector =
      target.kind === "account"
        ? `input[data-account-name="${CSS.escape(target.id)}"]`
        : `input[data-holding-memo="${CSS.escape(target.id)}"]`;
    scrollRef.current?.querySelector<HTMLInputElement>(selector)?.focus();
  }, [accounts]);

  const focusCell = (holdingId: string, month: number) => {
    const el = scrollRef.current?.querySelector<HTMLInputElement>(
      `input[data-cell="${CSS.escape(`${holdingId}:${month}`)}"]`,
    );
    if (!el) return false;
    el.focus();
    return true;
  };

  const navigate = (holdingId: string, month: number, dir: NavDirection): boolean => {
    const row = navOrder.indexOf(holdingId);
    const last = navOrder.length - 1;
    if (row < 0) return false;
    let target: [number, number] | null = null;
    switch (dir) {
      case "down":
        target = row < last ? [row + 1, month] : month < 12 ? [0, month + 1] : null;
        break;
      case "up":
        target = row > 0 ? [row - 1, month] : month > 1 ? [last, month - 1] : null;
        break;
      case "right":
        target = month < 12 ? [row, month + 1] : row < last ? [row + 1, 1] : null;
        break;
      case "left":
        target = month > 1 ? [row, month - 1] : row > 0 ? [row - 1, 12] : null;
        break;
    }
    return target ? focusCell(navOrder[target[0]], target[1]) : false;
  };

  const hasAnyData = (holdingIds: string[]) =>
    Object.values(store.yearlyData).some((yd) =>
      Object.values(yd.monthlyAmounts).some((amounts) => holdingIds.some((id) => id in amounts)),
    );

  const toggleCollapsed = (accountId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });

  const handleAddAccount = () => {
    if (!canAddAccount) return;
    pendingFocus.current = { kind: "account", id: actions.addAccount("") };
  };

  const handleRemoveAccount = (account: AssetAccount) => {
    const label = account.name || "この口座";
    if (
      hasAnyData(account.holdings.map((h) => h.id)) &&
      !window.confirm(`口座「${label}」を削除します。内訳と全年度の入力データも削除されます。よろしいですか？`)
    ) {
      return;
    }
    actions.removeAccount(account.id);
  };

  const handleAddHolding = (account: AssetAccount) => {
    if (account.holdings.length >= MAX_HOLDINGS_PER_ACCOUNT) return;
    // 折りたたみ中なら展開してから追加
    setCollapsed((prev) => {
      if (!prev.has(account.id)) return prev;
      const next = new Set(prev);
      next.delete(account.id);
      return next;
    });
    pendingFocus.current = { kind: "holding", id: actions.addHolding(account.id) };
  };

  const handleRemoveHolding = (holding: Holding) => {
    const label = holding.memo || "この内訳";
    if (
      hasAnyData([holding.id]) &&
      !window.confirm(`内訳「${label}」と全年度の入力データを削除します。よろしいですか？`)
    ) {
      return;
    }
    actions.removeHolding(holding.id);
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

  const hasHoldings = accounts.some((a) => a.holdings.length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-semibold text-slate-900">資産入力</h2>
            <YearSwitcher year={year} currentYear={currentYear} onYearChange={onYearChange} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {editing ? (
              <>
                各月末の残高を内訳ごとに入力。<Kbd>Enter</Kbd> で下へ、<Kbd>Tab</Kbd>{" "}
                で右へ移動します。入力が終わったら「保存」を押してください（入力がある月の空欄は0円になります）。
              </>
            ) : (
              "各月末時点の残高です。入力・修正するときは「編集」を押してください。"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing && (
            <>
              <button
                type="button"
                onClick={handleAddAccount}
                disabled={!canAddAccount}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden />
                口座を追加
                <span className="text-xs font-normal text-slate-400 tabular-nums">
                  {accounts.length}/{MAX_ACCOUNTS}
                </span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty}
                title={dirty ? "変更を保存します（入力がある月の空欄は0円として保存）" : "変更はありません"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save className="size-4" aria-hidden />
                保存
                {dirty && <span className="size-1.5 rounded-full bg-amber-300" aria-label="未保存の変更あり" />}
              </button>
            </>
          )}
          {!editing && (
            <button
              type="button"
              onClick={handleStartEditing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700"
            >
              <Pencil className="size-4" aria-hidden />
              編集
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto scroll-pl-52 sm:scroll-pl-72">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th
                scope="col"
                className={cn(
                  STICKY_COL,
                  "z-20 border-b border-r border-slate-200 bg-slate-50 px-4 py-2 text-left font-medium",
                )}
              >
                口座 / 内訳
              </th>
              {MONTHS.map((m) => {
                const prev = shiftMonth(year, m, -1);
                const canCopy = hasHoldings && hasMonthData(store, prev.year, prev.month);
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
                      {editing && (
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
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {accounts.map((account, accountIndex) => {
              const isCollapsed = collapsed.has(account.id);
              const canAddHolding = account.holdings.length < MAX_HOLDINGS_PER_ACCOUNT;
              return (
                <Fragment key={account.id}>
                  {/* 口座行（小計） */}
                  <tr className="group/account">
                    <th
                      scope="rowgroup"
                      className={cn(
                        STICKY_COL,
                        "z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-normal",
                        accountIndex > 0 && "border-t-4 border-t-white",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleCollapsed(account.id)}
                          aria-expanded={!isCollapsed}
                          aria-label={isCollapsed ? "内訳を表示" : "内訳を折りたたむ"}
                          className="grid size-6 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-200/70"
                        >
                          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: accountColor(accountIndex) }}
                          aria-hidden
                        />
                        {!editing ? (
                          <span className="min-w-0 flex-1 truncate px-1.5 py-1 text-sm font-semibold text-slate-900">
                            {account.name || <span className="font-normal text-slate-400">（名称未設定）</span>}
                          </span>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={account.name}
                              data-account-name={account.id}
                              onChange={(e) => actions.renameAccount(account.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                  e.preventDefault();
                                  const first = account.holdings[0];
                                  if (first && !isCollapsed) focusCell(first.id, 1);
                                }
                              }}
                              placeholder="口座名（例: SBI証券）"
                              aria-label={`口座名 ${accountIndex + 1}`}
                              maxLength={30}
                              className="w-full min-w-0 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 hover:bg-white focus:bg-white focus:ring-2 focus:ring-teal-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddHolding(account)}
                              disabled={!canAddHolding}
                              title={canAddHolding ? "内訳を追加" : `内訳は最大${MAX_HOLDINGS_PER_ACCOUNT}件です`}
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] text-slate-500 transition hover:bg-white hover:text-teal-700 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                              <Plus className="size-3.5" aria-hidden />
                              <span className="hidden tabular-nums sm:inline">
                                {account.holdings.length}/{MAX_HOLDINGS_PER_ACCOUNT}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAccount(account)}
                              aria-label={`口座「${account.name || "名称未設定"}」を削除`}
                              title="口座を削除"
                              className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:text-rose-600 can-hover:opacity-0 can-hover:group-hover/account:opacity-100 can-hover:focus:opacity-100"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </th>
                    {MONTHS.map((m) => {
                      const subtotal = getAccountMonthTotal(store, account, year, m);
                      return (
                        <td
                          key={m}
                          className={cn(
                            "border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-right font-semibold tabular-nums text-slate-700",
                            accountIndex > 0 && "border-t-4 border-t-white",
                            m === highlightMonth && "bg-teal-50/70",
                            subtotal === null && "font-normal text-slate-300",
                            subtotal === 0 && "font-normal text-slate-400",
                          )}
                        >
                          {subtotal === null ? "—" : formatNumber(subtotal)}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 内訳行 */}
                  {!isCollapsed &&
                    account.holdings.map((holding) => (
                      <tr key={holding.id} className="group/holding">
                        <th
                          scope="row"
                          className={cn(
                            STICKY_COL,
                            "z-10 border-b border-r border-slate-100 bg-white py-1.5 pl-8 pr-2 text-left font-normal group-hover/holding:bg-slate-50/60",
                          )}
                        >
                          {!editing ? (
                            <div className="min-w-0">
                              <p className="truncate px-1.5 py-0.5 text-sm text-slate-800">
                                {holding.memo || <span className="text-slate-400">（メモなし）</span>}
                              </p>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                <PillBadge
                                  option={ASSET_CLASSES.find((o) => o.id === holding.assetClass)}
                                  formatLabel={(o) => o.shortLabel ?? o.label}
                                />
                                <PillBadge
                                  option={REGIONS.find((o) => o.id === holding.region)}
                                  formatLabel={(o) => (o.id === "none" ? "地域なし" : o.label)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-1">
                              <div className="min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={holding.memo}
                                  data-holding-memo={holding.id}
                                  onChange={(e) => actions.updateHolding(holding.id, { memo: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                      e.preventDefault();
                                      focusCell(holding.id, 1);
                                    }
                                  }}
                                  placeholder="メモ（例: オルカン）"
                                  aria-label={`${account.name || "口座"}の内訳メモ`}
                                  maxLength={30}
                                  className="w-full min-w-0 rounded-md bg-transparent px-1.5 py-0.5 text-sm text-slate-800 outline-none placeholder:text-slate-300 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-teal-500"
                                />
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  <PillSelect<AssetClassId>
                                    value={holding.assetClass}
                                    options={ASSET_CLASSES}
                                    onChange={(v) => actions.updateHolding(holding.id, { assetClass: v })}
                                    ariaLabel="資産クラス"
                                    formatLabel={(o) => o.shortLabel ?? o.label}
                                  />
                                  <PillSelect<RegionId>
                                    value={holding.region}
                                    options={REGIONS}
                                    onChange={(v) => actions.updateHolding(holding.id, { region: v })}
                                    ariaLabel="地域"
                                    formatLabel={(o) => (o.id === "none" ? "地域なし" : o.label)}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveHolding(holding)}
                                disabled={account.holdings.length <= 1}
                                aria-label={`内訳「${holding.memo || "メモなし"}」を削除`}
                                title={
                                  account.holdings.length <= 1
                                    ? "最後の内訳は削除できません（口座ごと削除してください）"
                                    : "内訳を削除"
                                }
                                className="grid size-7 shrink-0 place-items-center rounded-md text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 focus:text-rose-600 disabled:invisible can-hover:opacity-0 can-hover:group-hover/holding:opacity-100 can-hover:focus:opacity-100"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          )}
                        </th>
                        {MONTHS.map((m) => {
                          const value = getMonthAmounts(store, year, m)?.[holding.id];
                          return (
                            <td
                              key={m}
                              className={cn(
                                "border-b border-slate-100 px-1 py-1",
                                m === highlightMonth && "bg-teal-50/40",
                              )}
                            >
                              {editing ? (
                                <AmountCell
                                  cellId={`${holding.id}:${m}`}
                                  ariaLabel={`${account.name || "口座"} ${holding.memo || "内訳"} ${m}月`}
                                  value={value}
                                  onCommit={(v) => actions.setAmount(year, m, holding.id, v)}
                                  onNavigate={(dir) => navigate(holding.id, m, dir)}
                                />
                              ) : (
                                // 編集時のセルと同じ大きさにして、切り替えても表がずれないようにする
                                <span
                                  className={cn(
                                    "block w-30 px-2.5 py-2 text-right text-sm tabular-nums",
                                    value === undefined ? "text-slate-300" : value === 0 ? "text-slate-400" : "text-slate-800",
                                  )}
                                >
                                  {value === undefined ? "—" : formatNumber(value)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              );
            })}

            {accounts.length === 0 && (
              <tr>
                <td colSpan={13} className="px-5 py-10 text-center text-sm text-slate-400">
                  {editing
                    ? "「口座を追加」から銀行口座や証券口座を登録してください"
                    : "口座がありません。「編集」に切り替えて、銀行口座や証券口座を登録してください"}
                </td>
              </tr>
            )}
          </tbody>

          {accounts.length > 0 && (
            <tfoot>
              <tr className="font-bold text-slate-900">
                <th
                  scope="row"
                  className={cn(
                    STICKY_COL,
                    "z-10 border-r border-t-2 border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm",
                  )}
                >
                  合計
                </th>
                {MONTHS.map((m) => {
                  const total = getMonthTotal(store, year, m);
                  return (
                    <td
                      key={m}
                      className={cn(
                        "border-t-2 border-slate-200 bg-slate-100 px-3.5 py-3 text-right tabular-nums",
                        m === highlightMonth && "bg-teal-100/70",
                        total === null && "font-normal text-slate-300",
                        total === 0 && "font-normal text-slate-400",
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

interface PillOption<T extends string> {
  id: T;
  label: string;
  shortLabel?: string;
  color: string;
}

function PillSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  formatLabel = (o) => o.label,
}: {
  value: T;
  options: readonly PillOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  formatLabel?: (option: PillOption<T>) => string;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <div className="relative inline-flex items-center">
      <span
        className="pointer-events-none absolute left-2 size-2 rounded-full"
        style={{ backgroundColor: current?.color ?? "#94a3b8" }}
        aria-hidden
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className="cursor-pointer appearance-none rounded-full border border-slate-200 bg-white py-0.5 pl-5 pr-5 text-xs text-slate-600 outline-none transition hover:border-slate-300 focus:ring-2 focus:ring-teal-500"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {formatLabel(o)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-slate-400" aria-hidden />
    </div>
  );
}

/** 参照のみ表示用の資産クラス・地域バッジ（PillSelect と同じ見た目で、操作はできない） */
function PillBadge<T extends string>({
  option,
  formatLabel,
}: {
  option: PillOption<T> | undefined;
  formatLabel: (option: PillOption<T>) => string;
}) {
  if (!option) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-2 pr-2.5 text-xs text-slate-600">
      <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} aria-hidden />
      {formatLabel(option)}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-slate-200 bg-slate-50 px-1 py-px font-sans text-[10px] text-slate-600">
      {children}
    </kbd>
  );
}
