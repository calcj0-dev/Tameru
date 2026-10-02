"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatNumber, parseAmountInput } from "@/lib/format";

export type NavDirection = "up" | "down" | "left" | "right";

interface AmountCellProps {
  value: number | undefined;
  cellId: string;
  ariaLabel: string;
  onCommit: (value: number | null) => void;
  /** 移動できたら true。false の場合は Tab のデフォルト動作に任せる */
  onNavigate: (direction: NavDirection) => boolean;
}

/**
 * 金額入力セル。
 * - フォーカス中は生の数値を全選択状態で表示、フォーカスが外れるとカンマ区切りで表示
 * - 入力は1文字ごとに確定する（解釈できる値になった時点で反映）。
 *   フォーカスが外れたときにだけ確定すると、スマホでは入力直後に「保存」を押しても入力欄からフォーカスが外れず、
 *   値が反映されないまま保存されてしまうため
 * - 最終的に解釈できない入力だった場合・Esc を押した場合は、フォーカスした時点の値に戻す
 * - Enter: 下のセルへ（最終行なら次の月の先頭へ） / Tab: 右のセルへ（12月なら次の行の1月へ）、Shift で逆方向
 */
export function AmountCell({ value, cellId, ariaLabel, onCommit, onNavigate }: AmountCellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  // フォーカスした時点の値（取り消し・不正な入力のときに戻す先）
  const originalRef = useRef<number | null>(null);
  const selectPendingRef = useRef(false);
  const justFocusedRef = useRef(false);

  // フォーカス直後の再描画（生の数値に切り替わった後）で同期的に全選択する。
  // rAF 等で遅延させると、素早く打鍵した場合に先頭文字が選択範囲に巻き込まれるため。
  useLayoutEffect(() => {
    if (selectPendingRef.current && draft !== null) {
      selectPendingRef.current = false;
      inputRef.current?.select();
    }
  }, [draft]);

  const display = draft ?? (value === undefined ? "" : formatNumber(value));

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      data-cell={cellId}
      aria-label={ariaLabel}
      value={display}
      placeholder="—"
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const parsed = parseAmountInput(text);
        // 解釈できる値なら、その場で確定（入力途中の「-」などは確定しない）
        if (parsed !== undefined && parsed !== (value ?? null)) onCommit(parsed);
      }}
      onFocus={(e) => {
        selectPendingRef.current = true;
        justFocusedRef.current = true;
        originalRef.current = value ?? null;
        setDraft(value === undefined ? "" : String(value));
        e.currentTarget.select();
      }}
      onMouseUp={(e) => {
        // クリックでフォーカスした際、mouseup によって全選択が解除されるのを防ぐ
        if (justFocusedRef.current) e.preventDefault();
        justFocusedRef.current = false;
      }}
      onBlur={() => {
        // 最後の入力が解釈できない値（例: "abc"）なら、フォーカスした時点の値に戻す
        if (!cancelRef.current && draft !== null && parseAmountInput(draft) === undefined) {
          if ((value ?? null) !== originalRef.current) onCommit(originalRef.current);
        }
        cancelRef.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        justFocusedRef.current = false;
        // IME変換確定の Enter では移動しない
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter") {
          e.preventDefault();
          onNavigate(e.shiftKey ? "up" : "down");
        } else if (e.key === "Tab") {
          if (onNavigate(e.shiftKey ? "left" : "right")) e.preventDefault();
        } else if (e.key === "Escape") {
          // 編集を取り消して、フォーカスした時点の値に戻す
          if ((value ?? null) !== originalRef.current) onCommit(originalRef.current);
          cancelRef.current = true;
          e.currentTarget.blur();
        }
      }}
      // 0円は薄いグレーで表示（入力された金額を目立たせる）
      data-zero={draft === null && value === 0 ? "" : undefined}
      className="w-30 data-[zero]:text-slate-400 rounded-md bg-transparent px-2.5 py-2 text-right text-sm tabular-nums text-slate-800 outline-none transition placeholder:text-slate-300 hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-teal-500"
    />
  );
}
