"use client";

import { Eye, EyeOff } from "lucide-react";
import { useAmountVisibility } from "@/lib/amountVisibility";
import { cn } from "@/lib/utils";

/**
 * 金額を隠す／表示するの切り替えボタン（ホームの総資産カード・記録の画面に置く）。
 * tone="onDark" は緑の総資産カードの上で使う。
 */
export function AmountVisibilityToggle({ tone = "default", className }: { tone?: "default" | "onDark"; className?: string }) {
  const { hidden, setHidden } = useAmountVisibility();
  const label = hidden ? "金額を表示" : "金額を隠す";
  return (
    <button
      type="button"
      onClick={() => setHidden(!hidden)}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      data-capture-hide
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg transition",
        tone === "onDark"
          ? "text-teal-50/90 hover:bg-white/15 hover:text-white"
          : "border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-teal-300 hover:text-teal-700 size-9",
        className,
      )}
    >
      {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}
