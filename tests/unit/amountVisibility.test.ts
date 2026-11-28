import { describe, expect, it } from "vitest";
import { amountFormatters, HIDDEN_YEN } from "@/lib/amountVisibility";

describe("金額を隠すモードの表示", () => {
  it("表示するときは、ふだんどおりの金額", () => {
    const f = amountFormatters(false);
    expect(f.yen(1_234_567)).toBe("¥1,234,567");
    expect(f.signedYen(-1200)).toBe("-¥1,200");
    expect(f.number(1_234_567)).toBe("1,234,567");
  });

  it("隠すときは、金額の大きさに関係なく同じ長さの記号にする（桁数から推測されない）", () => {
    const f = amountFormatters(true);
    expect(f.yen(1)).toBe(HIDDEN_YEN);
    expect(f.yen(123_456_789)).toBe(HIDDEN_YEN);
    expect(f.compactYen(52_000_000)).toBe("*****");
    expect(f.number(0)).toBe("*****");
  });

  it("増減の金額は符号だけ残す（増減の向きは % でも分かるため）", () => {
    const f = amountFormatters(true);
    expect(f.signedYen(5000)).toBe(`+${HIDDEN_YEN}`);
    expect(f.signedYen(-5000)).toBe(`-${HIDDEN_YEN}`);
    expect(f.signedYen(0)).toBe(HIDDEN_YEN);
  });
});
