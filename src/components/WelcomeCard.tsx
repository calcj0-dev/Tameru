"use client";

import { useState } from "react";
import { Check, CircleHelp, X } from "lucide-react";
import { HelpDialog } from "@/components/HelpDialog";

const DISMISSED_KEY = "tameru:welcome-dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 初めて開いた人向けの紹介。一度閉じたら出さない。
 * マウント後（データ読み込み後）にだけ描画される前提で、初期値を LocalStorage から読む。
 */
export function WelcomeCard() {
  const [dismissed, setDismissed] = useState(isDismissed);
  const [helpOpen, setHelpOpen] = useState(false);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // 保存できなくても、この表示中は閉じたままにする
    }
  };

  return (
    <section aria-label="TAMERU の紹介" className="relative rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="紹介を閉じる"
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-teal-700/70 hover:bg-teal-100 hover:text-teal-900"
      >
        <X className="size-4" aria-hidden />
      </button>
      <h2 className="pr-8 text-base font-semibold text-teal-950">ようこそ TAMERU へ</h2>
      <p className="mt-1 text-sm text-teal-900">毎月の資産を記録して、増え方をグラフで確認できるアプリです。</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-teal-950 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {["無料・登録なしですぐ使える", "銀行や証券の口座連携は不要", "スプレッドシートから移行できる"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-teal-600" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
        >
          <CircleHelp className="size-4" aria-hidden />
          使い方を見る
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
        >
          はじめる
        </button>
      </div>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </section>
  );
}
