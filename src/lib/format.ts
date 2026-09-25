const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

/** 1000000 -> "1,000,000" */
export function formatNumber(value: number): string {
  return numberFormatter.format(safeNumber(value));
}

/** 1000000 -> "¥1,000,000" / -500 -> "-¥500" */
export function formatYen(value: number): string {
  const v = safeNumber(value);
  return `${v < 0 ? "-" : ""}¥${formatNumber(Math.abs(v))}`;
}

/** 増減表示用: "+¥1,000" / "-¥1,000" / "±¥0" */
export function formatSignedYen(value: number): string {
  const v = safeNumber(value);
  const sign = v > 0 ? "+" : v < 0 ? "-" : "±";
  return `${sign}¥${formatNumber(Math.abs(v))}`;
}

/** 0.0123 -> "+1.23%"（null は "—"） */
export function formatSignedPercent(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  const pct = rate * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "±";
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

/** グラフ軸用の短縮表記: 123456789 -> "1.23億", 1234567 -> "123万" */
export function formatCompactYen(value: number): string {
  const v = safeNumber(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${trimZeros((abs / 100_000_000).toFixed(2))}億`;
  if (abs >= 10_000) return `${sign}${formatNumber(Math.round(abs / 10_000))}万`;
  return `${sign}${formatNumber(abs)}`;
}

/**
 * ユーザー入力を金額（整数円）に変換する。
 * 全角数字・カンマ・円記号・空白を許容。空文字は null（未入力）、解釈不能は undefined。
 */
export function parseAmountInput(input: string): number | null | undefined {
  const normalized = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".")
    .replace(/[－ー−‐]/g, "-")
    .replace(/[,，、\s¥￥円]/g, "");
  if (normalized === "") return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, "");
}
