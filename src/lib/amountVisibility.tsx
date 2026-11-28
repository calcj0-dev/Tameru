"use client";

import { createContext, useContext } from "react";
import { formatCompactYen, formatNumber, formatSignedYen, formatYen } from "@/lib/format";

/**
 * 金額を隠すモード。
 * 隠している間は、金額を大きさに関係なく同じ長さの記号にする（桁数から金額を推測されないように）。
 * 増減率（%）・構成比（%）・グラフの形はそのまま見せる。
 */
export const HIDDEN_AMOUNT = "*****";
export const HIDDEN_YEN = `¥${HIDDEN_AMOUNT}`;

/** 端末に覚えておくためのキー（同期はしない。PC とスマホで別々に設定できる） */
const STORAGE_KEY = "tameru:hide-amounts";

export function loadHideAmounts(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveHideAmounts(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存できなくても、この表示中は切り替えた状態のままにする
  }
}

export interface AmountVisibility {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

export const AmountVisibilityContext = createContext<AmountVisibility>({ hidden: false, setHidden: () => {} });

export function useAmountVisibility(): AmountVisibility {
  return useContext(AmountVisibilityContext);
}

/** 金額の表示に使う関数。隠すモードのときは記号を返す */
export function amountFormatters(hidden: boolean) {
  return {
    /** ¥1,234,567 */
    yen: (v: number) => (hidden ? HIDDEN_YEN : formatYen(v)),
    /** +¥1,234（符号は残す。増減の向きは % でも分かるため） */
    signedYen: (v: number) => (hidden ? `${v > 0 ? "+" : v < 0 ? "-" : ""}${HIDDEN_YEN}` : formatSignedYen(v)),
    /** 123万 */
    compactYen: (v: number) => (hidden ? HIDDEN_AMOUNT : formatCompactYen(v)),
    /** 1,234,567（入力表） */
    number: (v: number) => (hidden ? HIDDEN_AMOUNT : formatNumber(v)),
  };
}

/** 金額の表示に使う関数（隠すモードの状態を自動で反映） */
export function useAmounts() {
  return amountFormatters(useAmountVisibility().hidden);
}
