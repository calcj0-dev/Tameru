import { describe, expect, it } from "vitest";
import {
  formatCompactYen,
  formatNumber,
  formatSignedPercent,
  formatSignedYen,
  formatYen,
  parseAmountInput,
} from "@/lib/format";

describe("parseAmountInput（金額入力の解釈）", () => {
  it.each([
    ["1000000", 1000000],
    ["1,000,000", 1000000],
    ["１２３４５", 12345], // 全角数字
    ["１，０００", 1000], // 全角カンマ
    ["¥5,000", 5000],
    ["￥5,000円", 5000],
    [" 3 000 ", 3000], // 空白
    ["-2500", -2500],
    ["－2500", -2500], // 全角マイナス
    ["1234.6", 1235], // 小数は四捨五入
  ])("「%s」→ %d", (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it("空欄は null（未入力）", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("  ")).toBeNull();
  });

  it("解釈できない入力は undefined（元の値に戻す）", () => {
    expect(parseAmountInput("abc")).toBeUndefined();
    expect(parseAmountInput("1-2")).toBeUndefined();
  });
});

describe("金額の表示", () => {
  it("カンマ区切り・円記号", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatYen(1234567)).toBe("¥1,234,567");
    expect(formatYen(-500)).toBe("-¥500");
  });

  it("増減は符号付き", () => {
    expect(formatSignedYen(1000)).toBe("+¥1,000");
    expect(formatSignedYen(-1000)).toBe("-¥1,000");
    expect(formatSignedYen(0)).toBe("±¥0");
  });

  it("率は小数2桁・符号付き、計算できないときは —", () => {
    expect(formatSignedPercent(0.0123)).toBe("+1.23%");
    expect(formatSignedPercent(-0.05)).toBe("-5.00%");
    expect(formatSignedPercent(null)).toBe("—");
  });

  it("グラフ用の短縮表記（万・億）", () => {
    expect(formatCompactYen(3_480_000)).toBe("348万");
    expect(formatCompactYen(123_000_000)).toBe("1.23億");
    expect(formatCompactYen(100_000_000)).toBe("1億");
    expect(formatCompactYen(5_000)).toBe("5,000");
  });

  it("NaN や Infinity でも落ちない（0 として表示）", () => {
    expect(formatYen(Number.NaN)).toBe("¥0");
    expect(formatCompactYen(Number.POSITIVE_INFINITY)).toBe("0");
  });
});
