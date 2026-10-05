"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, ClipboardPaste, FileOutput, TriangleAlert } from "lucide-react";
import type { TameruStore } from "@/types/asset";
import { getEarliestDataMonth } from "@/lib/assetCalc";
import { buildSheet, readSheet, toTsv, type SheetChange, type SheetImportResult } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/Dialog";

type Step = "export" | "import";

interface SpreadsheetDialogProps {
  /** 編集中のデータ（下書き） */
  store: TameruStore;
  currentYear: number;
  onApply: (changes: SheetChange[], range: NonNullable<SheetImportResult["range"]>) => void;
  onClose: () => void;
}

/**
 * スプレッドシートとのやり取り。
 * ① アプリの口座・内訳に合わせた表を出力（コピー）→ スプレッドシートに貼り付けて金額を埋める
 * ② 埋めた表をコピーして貼り付け → 照合して下書きに取り込む（保存するまで確定しない・元に戻せる）
 */
export function SpreadsheetDialog({ store, currentYear, onApply, onClose }: SpreadsheetDialogProps) {
  const [step, setStep] = useState<Step>("export");
  const holdingCount = store.accounts.reduce((n, a) => n + a.holdings.length, 0);

  return (
    <Dialog title="スプレッドシートと連携" onClose={onClose} className="max-w-2xl">
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
        <StepTab active={step === "export"} onClick={() => setStep("export")} icon={<FileOutput className="size-4" />}>
          ① 表を出力
        </StepTab>
        <StepTab active={step === "import"} onClick={() => setStep("import")} icon={<ClipboardPaste className="size-4" />}>
          ② 取り込む
        </StepTab>
      </div>
      <p className="mt-3 text-xs text-slate-500 sm:hidden">大きな表のコピー・貼り付けは PC での操作がおすすめです。</p>

      {holdingCount === 0 ? (
        <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          先に「口座を追加」で口座と内訳を作成してください。作成した口座・内訳に合わせた表を出力します。
        </p>
      ) : step === "export" ? (
        <ExportStep store={store} currentYear={currentYear} onNext={() => setStep("import")} />
      ) : (
        <ImportStep store={store} onApply={onApply} />
      )}
    </Dialog>
  );
}

function StepTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ① 表を出力
// ---------------------------------------------------------------------------

function ExportStep({ store, currentYear, onNext }: { store: TameruStore; currentYear: number; onNext: () => void }) {
  const [fromYear, setFromYear] = useState(currentYear);
  const [toYear, setToYear] = useState(currentYear);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  const earliest = getEarliestDataMonth(store)?.year ?? currentYear;
  const years: number[] = [];
  for (let y = Math.min(earliest, currentYear - 10); y <= currentYear + 1; y++) years.push(y);

  const rows = useMemo(() => buildSheet(store, fromYear, toYear), [store, fromYear, toYear]);
  const tsv = useMemo(() => toTsv(rows), [rows]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  // プレビューは先頭の数列だけ
  const previewCols = 2 + Math.min(4, rows[0].length - 2);
  const hasMore = rows[0].length > previewCols;

  return (
    <div className="mt-4 space-y-4 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-slate-600">
        <li>期間を選んで「表をコピー」を押します（今入力されている金額も入ります）</li>
        <li>スプレッドシートの左上のセル（A1）に貼り付けます</li>
        <li>スプレッドシート上で、金額を入力するか、元の表から貼り付けます</li>
        <li>「② 取り込む」へ進みます</li>
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-600">期間</span>
        <YearSelect value={fromYear} years={years} label="開始年" onChange={(y) => { setFromYear(y); if (y > toYear) setToYear(y); setCopied(null); }} />
        <span className="text-slate-400">〜</span>
        <YearSelect value={toYear} years={years} label="終了年" onChange={(y) => { setToYear(y); if (y < fromYear) setFromYear(y); setCopied(null); }} />
        <span className="text-xs text-slate-400">（{(toYear - fromYear + 1) * 12}か月分）</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <tbody>
            {rows.slice(0, 5).map((r, i) => (
              <tr key={i} className={i === 0 ? "bg-slate-50 font-medium text-slate-700" : "text-slate-600"}>
                {r.slice(0, previewCols).map((c, j) => (
                  <td key={j} className="whitespace-nowrap border-b border-slate-100 px-2 py-1.5">
                    {c}
                  </td>
                ))}
                {hasMore && <td className="border-b border-slate-100 px-2 py-1.5 text-slate-400">…</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 5 && <p className="px-2 py-1 text-[11px] text-slate-400">ほか {rows.length - 5} 行</p>}
      </div>

      <ul className="space-y-1 text-xs text-slate-500">
        <li>・「口座名」「メモ」と見出しの年月は変更しないでください（取り込むときの目印になります）</li>
        <li>・行の順番の入れ替えや、「合計」などの列・行の追加は問題ありません</li>
        <li>・空欄のセルは取り込んでも変更されません</li>
      </ul>

      {copied === "failed" && (
        <div className="space-y-1">
          <p className="text-xs text-rose-600">自動でコピーできませんでした。下の枠の中を全選択（Ctrl+A）してコピー（Ctrl+C）してください。</p>
          <textarea readOnly value={tsv} rows={4} className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onNext} className="rounded-lg px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-100">
          ② 取り込むへ
        </button>
        <button
          type="button"
          onClick={copy}
          data-autofocus
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 font-medium text-white shadow-sm hover:bg-teal-700"
        >
          {copied === "done" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
          {copied === "done" ? "コピーしました" : "表をコピー"}
        </button>
      </div>
    </div>
  );
}

function YearSelect({
  value,
  years,
  label,
  onChange,
}: {
  value: number;
  years: number[];
  label: string;
  onChange: (year: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}年
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// ② 取り込む
// ---------------------------------------------------------------------------

const MAX_LISTED_ERRORS = 8;

function ImportStep({
  store,
  onApply,
}: {
  store: TameruStore;
  onApply: (changes: SheetChange[], range: NonNullable<SheetImportResult["range"]>) => void;
}) {
  const [text, setText] = useState("");
  const result = useMemo(() => (text.trim() ? readSheet(text, store) : null), [text, store]);
  const canImport = !!result && !result.fatal && result.errors.length === 0 && result.changes.length > 0 && !!result.range;
  const fmt = (ym: { year: number; month: number }) => `${ym.year}年${ym.month}月`;

  return (
    <div className="mt-4 space-y-4 text-sm">
      <p className="text-slate-600">
        スプレッドシートで、<strong>見出しの行も含めて</strong>表全体を選択してコピーし、下の枠に貼り付けてください。
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-autofocus
        rows={5}
        aria-label="貼り付ける表"
        placeholder="ここに貼り付け（Ctrl+V）"
        className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
      />

      {result && (
        <div className="space-y-2" role="status">
          {result.fatal ? (
            <Problem>{result.fatal}</Problem>
          ) : (
            <>
              {result.errors.length > 0 ? null : result.changes.length > 0 && result.range ? (
                <p className="rounded-lg bg-teal-50 p-3 text-teal-900">
                  {result.matchedRows}件の内訳・{fmt(result.range.from)}〜{fmt(result.range.to)}・
                  <strong>{result.changes.length}セル</strong>を書き込みます
                  {result.unchangedCells > 0 && <span className="text-teal-700/80">（今と同じ値の {result.unchangedCells} セルはそのまま）</span>}
                </p>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-slate-600">変更するセルはありません（今の値と同じか、空欄です）。</p>
              )}
              {result.errors.length > 0 && (
                <Problem>
                  <p className="font-medium">次の問題を直してから、もう一度貼り付けてください（{result.errors.length}件）</p>
                  <ul className="mt-1 space-y-0.5">
                    {result.errors.slice(0, MAX_LISTED_ERRORS).map((e, i) => (
                      <li key={i}>
                        {e.row}行目: {e.message}
                      </li>
                    ))}
                    {result.errors.length > MAX_LISTED_ERRORS && <li>ほか {result.errors.length - MAX_LISTED_ERRORS} 件</li>}
                  </ul>
                </Problem>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canImport}
          onClick={() => result?.range && onApply(result.changes, result.range)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 font-medium text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <ClipboardPaste className="size-4" />
          取り込む
        </button>
      </div>
      <p className="text-right text-xs text-slate-400">取り込んだ内容は「保存」するまで確定しません。「元に戻す」で取り消せます。</p>
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
