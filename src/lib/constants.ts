export const MAX_CATEGORIES = 10;

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

// カテゴリの並び順（index）に対応する表示色。最大10カテゴリ分。
export const CATEGORY_COLORS = [
  "#0d9488", // teal
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#84cc16", // lime
  "#8b5cf6", // violet
  "#f97316", // orange
  "#0e7490", // cyan
  "#64748b", // slate
] as const;

export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}
