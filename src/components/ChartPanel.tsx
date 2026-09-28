"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, Maximize2, TriangleAlert, X } from "lucide-react";
import { captureFileName, saveElementAsPng } from "@/lib/capture";
import { cn } from "@/lib/utils";

interface ChartPanelProps {
  title: string;
  subtitle: string;
  /** 保存ファイル名に使うラベル（例: 資産推移） */
  captureLabel: string;
  /** 期間切り替え等の操作UI（画像保存時は含めない） */
  controls?: ReactNode;
  className?: string;
  /** expanded=true のとき拡大表示用の大きさで描画する */
  children: (expanded: boolean) => ReactNode;
}

type SaveStatus = "idle" | "saving" | "done" | "error";

/**
 * グラフ用のカード。ヘッダー右側に「拡大」「画像保存」ボタンを持つ。
 * 拡大時はモーダルで同じ内容を大きく描画する。
 */
export function ChartPanel({ title, subtitle, captureLabel, controls, className, children }: ChartPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const handleSave = async (node: HTMLElement | null) => {
    if (!node || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      await saveElementAsPng(node, captureFileName(captureLabel));
      setSaveStatus("done");
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  // モーダル表示中: Esc で閉じる・背景スクロール禁止・閉じるボタンへフォーカス
  useEffect(() => {
    if (!expanded) return;
    const expandButton = expandButtonRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      expandButton?.focus();
    };
  }, [expanded]);

  const header = (isModal: boolean) => (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h2 className={cn("font-semibold text-slate-900", isModal && "text-lg")}>{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-capture-hide>
        {controls}
        <div className="flex items-center gap-0.5">
          <IconButton
            label={saveStatusLabel(saveStatus)}
            onClick={() => handleSave(isModal ? modalContentRef.current : cardRef.current)}
            disabled={saveStatus === "saving"}
            tone={saveStatus === "error" ? "error" : saveStatus === "done" ? "success" : "default"}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saveStatus === "done" ? (
              <Check className="size-4" />
            ) : saveStatus === "error" ? (
              <TriangleAlert className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
          </IconButton>
          {isModal ? (
            <IconButton label="閉じる" onClick={() => setExpanded(false)} buttonRef={closeButtonRef}>
              <X className="size-4" />
            </IconButton>
          ) : (
            <IconButton label="拡大表示" onClick={() => setExpanded(true)} buttonRef={expandButtonRef}>
              <Maximize2 className="size-4" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <section
        ref={cardRef}
        className={cn("flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}
      >
        {header(false)}
        {children(false)}
      </section>

      {expanded &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setExpanded(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div
              ref={modalContentRef}
              className="flex max-h-full w-full max-w-6xl flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
            >
              {header(true)}
              {children(true)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "画像を保存中…";
    case "done":
      return "画像を保存しました";
    case "error":
      return "画像の保存に失敗しました";
    default:
      return "画像として保存";
  }
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = "default",
  buttonRef,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "success" | "error";
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg transition disabled:cursor-wait",
        tone === "default" && "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        tone === "success" && "text-emerald-600",
        tone === "error" && "text-rose-600",
      )}
    >
      {children}
    </button>
  );
}
