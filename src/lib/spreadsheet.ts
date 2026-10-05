import type { TameruStore } from "@/types/asset";
import { getMonthAmounts } from "@/lib/assetCalc";
import { MONTHS } from "@/lib/constants";
import { parseAmountInput } from "@/lib/format";

/**
 * スプレッドシートとのやり取り。
 * 1. アプリで作った口座・内訳の構成に合わせた表（タブ区切り）を出力する → スプレッドシートに貼り付け
 * 2. ユーザーがスプレッドシートで金額を埋める
 * 3. 表をコピーしてアプリに貼り付ける → 「口座名＋メモ」で内訳を、見出しの年月で月を照合して取り込む
 */

const NAME_HEADER = "口座名";
const MEMO_HEADER = "メモ";
/** 合計などの集計行として読み飛ばす口座名 */
const SKIP_NAMES = new Set(["合計", "総資産", "小計", "総計"]);

/** 見出しの年月の書き方（スプレッドシートが日付に自動変換しても読めるように幅広く受け付ける） */
export function parseMonthHeader(text: string): { year: number; month: number } | null {
  const s = text.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const m =
    s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*\d{1,2}\s*日)?$/) ?? // 2025年1月 / 2025年1月1日
    s.match(/^(\d{4})[/\-.](\d{1,2})(?:[/\-.]\d{1,2})?$/); // 2025/1, 2025-01, 2025.1, 2025/1/1
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 1900 || year > 2200) return null;
  return { year, month };
}

const monthLabel = (year: number, month: number) => `${year}年${month}月`;

/**
 * 出力する表（タブ区切り）。1行目が見出し（口座名・メモ・各月）、2行目以降が内訳ごとの金額。
 * 見出しの月は「2025年1月」の形（スプレッドシートで日付に変換されても表示が変わりにくい）。
 */
export function buildSheet(store: TameruStore, fromYear: number, toYear: number): string[][] {
  const months: { year: number; month: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) for (const m of MONTHS) months.push({ year: y, month: m });

  const header = [NAME_HEADER, MEMO_HEADER, ...months.map((x) => monthLabel(x.year, x.month))];
  const rows = store.accounts.flatMap((a) =>
    a.holdings.map((h) => [
      a.name,
      h.memo,
      ...months.map(({ year, month }) => {
        const v = getMonthAmounts(store, year, month)?.[h.id];
        return typeof v === "number" ? String(v) : "";
      }),
    ]),
  );
  return [header, ...rows];
}

/** 表をタブ区切りの文字列にする（セル内にタブ・改行・" があれば " で囲む） */
export function toTsv(rows: string[][]): string {
  const cell = (v: string) => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(cell).join("\t")).join("\n");
}

/** スプレッドシートからコピーした文字列（タブ区切り）を表にする。" で囲まれたセルにも対応 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export interface SheetChange {
  holdingId: string;
  year: number;
  month: number;
  value: number;
}

export interface SheetIssue {
  /** 表の行番号（1始まり） */
  row: number;
  message: string;
}

export interface SheetImportResult {
  /** 取り込みできない理由（見出しがない等）。あれば他の結果は空 */
  fatal: string | null;
  /** 書き込む値（今の値と同じものは含まない） */
  changes: SheetChange[];
  /** 照合できた内訳の数 */
  matchedRows: number;
  /** 取り込みを止めるべき問題（照合できない行・数値として読めないセル） */
  errors: SheetIssue[];
  /** 今の値と同じで変更のないセルの数 */
  unchangedCells: number;
  /** 取り込む期間（変更がある月の範囲） */
  range: { from: { year: number; month: number }; to: { year: number; month: number } } | null;
}

const EMPTY_RESULT: Omit<SheetImportResult, "fatal"> = {
  changes: [],
  matchedRows: 0,
  errors: [],
  unchangedCells: 0,
  range: null,
};

/**
 * 貼り付けられた表を読み取り、アプリの内訳・月と照合する。
 * - 見出し: 「口座名」を含む最初の行。「メモ」列は任意。年月として読める列が月の列（それ以外の列は無視）
 * - 行: 「口座名＋メモ」でアプリの内訳と照合（行の順番は自由）。合計などの行・空行は読み飛ばす
 * - 空欄のセルは変更しない
 */
export function readSheet(text: string, store: TameruStore): SheetImportResult {
  const table = parseTsv(text);
  const headerIndex = table.findIndex((r) => r.some((c) => c.trim() === NAME_HEADER));
  if (headerIndex < 0) {
    return { ...EMPTY_RESULT, fatal: `見出しの行（「${NAME_HEADER}」の列）が見つかりません。出力した表の見出しの行も含めてコピーしてください。` };
  }
  const header = table[headerIndex].map((c) => c.trim());
  const nameCol = header.indexOf(NAME_HEADER);
  const memoCol = header.indexOf(MEMO_HEADER);
  const monthCols = header
    .map((c, i) => ({ i, ym: parseMonthHeader(c) }))
    .filter((x): x is { i: number; ym: { year: number; month: number } } => x.ym !== null);
  if (monthCols.length === 0) {
    return { ...EMPTY_RESULT, fatal: "年月の列（例: 2025年1月）が見つかりません。見出しの行を変更していないか確認してください。" };
  }

  // 「口座名＋メモ」→ 内訳ID（同じ組み合わせが複数あれば、上から順に割り当てる）
  const keyOf = (name: string, memo: string) => `${name.trim()}\u0000${memo.trim()}`;
  const candidates = new Map<string, string[]>();
  for (const a of store.accounts) {
    for (const h of a.holdings) {
      const key = keyOf(a.name, h.memo);
      candidates.set(key, [...(candidates.get(key) ?? []), h.id]);
    }
  }

  const changes: SheetChange[] = [];
  const errors: SheetIssue[] = [];
  let matchedRows = 0;
  let unchangedCells = 0;

  for (let r = headerIndex + 1; r < table.length; r++) {
    const row = table[r];
    const rowNo = r + 1;
    if (row.every((c) => c.trim() === "")) continue;
    const name = (row[nameCol] ?? "").trim();
    const memo = memoCol >= 0 ? (row[memoCol] ?? "").trim() : "";
    if (SKIP_NAMES.has(name)) continue;

    const ids = candidates.get(keyOf(name, memo));
    const holdingId = ids?.shift();
    if (!holdingId) {
      errors.push({
        row: rowNo,
        message: `「${name || "（口座名なし）"}${memo ? ` / ${memo}` : ""}」は TAMERU にない内訳です。口座名・メモを出力した表のとおりにするか、先に TAMERU で内訳を追加してください。`,
      });
      continue;
    }
    matchedRows++;

    for (const { i, ym } of monthCols) {
      const raw = (row[i] ?? "").trim();
      if (raw === "" || raw === "-" || raw === "—" || raw === "－") continue; // 空欄は変更しない
      const value = parseAmountInput(raw);
      if (value === undefined || value === null) {
        errors.push({ row: rowNo, message: `${monthLabel(ym.year, ym.month)} の「${raw}」は金額として読めません。` });
        continue;
      }
      const current = getMonthAmounts(store, ym.year, ym.month)?.[holdingId];
      if (current === value) {
        unchangedCells++;
        continue;
      }
      changes.push({ holdingId, year: ym.year, month: ym.month, value });
    }
  }

  const sorted = [...changes].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  const range =
    sorted.length > 0
      ? {
          from: { year: sorted[0].year, month: sorted[0].month },
          to: { year: sorted[sorted.length - 1].year, month: sorted[sorted.length - 1].month },
        }
      : null;

  return { fatal: null, changes, matchedRows, errors, unchangedCells, range };
}
