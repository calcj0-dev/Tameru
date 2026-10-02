"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  title: string;
  /** 閉じる操作（× / Esc / 背景クリック）。undefined なら閉じられない（必ず選択させる） */
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

/** 画面中央に出す確認・説明用のダイアログ */
export function Dialog({ title, onClose, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={cn("max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl", className)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="-mr-2 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** ダイアログ内の説明リスト（チェック付きの箇条書き） */
export function DialogList({ items }: { items: { icon: ReactNode; text: ReactNode }[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
          <span className="mt-0.5 shrink-0">{item.icon}</span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
