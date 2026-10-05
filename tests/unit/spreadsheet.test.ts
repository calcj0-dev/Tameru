import { describe, expect, it } from "vitest";
import { applyEditAction } from "@/lib/storeReducer";
import { buildSheet, parseMonthHeader, parseTsv, readSheet, toTsv } from "@/lib/spreadsheet";
import { account, holding, sampleAccounts, store } from "./helpers";

// 銀行/普通預金(h1)、SBI証券/オルカン(h2)、SBI証券/米国株(h3)
const s = store(sampleAccounts(), { "2026-01": { h1: 100, h2: 200 } });

describe("表の出力", () => {
  it("見出し（口座名・メモ・各月）と内訳ごとの行。入力済みの金額も入る", () => {
    const rows = buildSheet(s, 2026, 2026);
    expect(rows[0].slice(0, 4)).toEqual(["口座名", "メモ", "2026年1月", "2026年2月"]);
    expect(rows[0]).toHaveLength(2 + 12);
    expect(rows.slice(1).map((r) => r.slice(0, 3))).toEqual([
      ["銀行", "普通預金", "100"],
      ["SBI証券", "オルカン", "200"],
      ["SBI証券", "米国株", ""],
    ]);
  });

  it("複数年は月の列が続けて並ぶ", () => {
    const header = buildSheet(s, 2025, 2026)[0];
    expect(header).toHaveLength(2 + 24);
    expect(header[2]).toBe("2025年1月");
    expect(header[25]).toBe("2026年12月");
  });

  it("出力した表をそのまま読み戻せる（タブ区切りの往復）", () => {
    const rows = buildSheet(s, 2026, 2026);
    expect(parseTsv(toTsv(rows))).toEqual(rows);
  });
});

describe("年月の見出しの読み取り", () => {
  it.each([
    ["2026年1月", 2026, 1],
    ["2026/1", 2026, 1],
    ["2026/01", 2026, 1],
    ["2026-01", 2026, 1],
    ["2026.1", 2026, 1],
    ["2026/1/1", 2026, 1], // スプレッドシートが日付に変換した場合
    ["2026年1月1日", 2026, 1],
    ["２０２６年１２月", 2026, 12],
  ])("「%s」→ %d年%d月", (text, year, month) => {
    expect(parseMonthHeader(text)).toEqual({ year, month });
  });

  it.each(["口座名", "合計", "2026", "2026年13月", "1月"])("「%s」は年月として扱わない", (text) => {
    expect(parseMonthHeader(text)).toBeNull();
  });
});

describe("貼り付けた表の取り込み", () => {
  const tsv = (rows: string[][]) => rows.map((r) => r.join("\t")).join("\n");

  it("口座名＋メモで照合し、空欄は変更しない。今と同じ値は書き込まない", () => {
    const result = readSheet(
      tsv([
        ["口座名", "メモ", "2026年1月", "2026年2月"],
        ["銀行", "普通預金", "100", "150"], // 1月は同じ値、2月は新規
        ["SBI証券", "米国株", "", "3,000"], // 空欄は変更しない
      ]),
      s,
    );
    expect(result.fatal).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.matchedRows).toBe(2);
    expect(result.unchangedCells).toBe(1);
    expect(result.changes).toEqual([
      { holdingId: "h1", year: 2026, month: 2, value: 150 },
      { holdingId: "h3", year: 2026, month: 2, value: 3000 },
    ]);
    expect(result.range).toEqual({ from: { year: 2026, month: 2 }, to: { year: 2026, month: 2 } });
  });

  it("行の順番の入れ替え・余分な列・タイトル行・合計行・空行があっても読める", () => {
    const result = readSheet(
      tsv([
        ["私の資産管理表"],
        [""],
        ["備考", "メモ", "口座名", "2026/3", "合計"],
        ["", "米国株", "SBI証券", "¥5,000", "999"],
        ["", "普通預金", "銀行", "１０００", ""],
        ["", "", "合計", "6000", ""],
        ["", "", "", "", ""],
      ]),
      s,
    );
    expect(result.errors).toEqual([]);
    expect(result.changes).toEqual([
      { holdingId: "h3", year: 2026, month: 3, value: 5000 },
      { holdingId: "h1", year: 2026, month: 3, value: 1000 },
    ]);
  });

  it("アプリにない内訳の行・金額として読めないセルはエラー（行番号付き）", () => {
    const result = readSheet(
      tsv([
        ["口座名", "メモ", "2026年4月"],
        ["楽天証券", "S&P500", "100"],
        ["銀行", "普通預金", "abc"],
      ]),
      s,
    );
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ row: 2 });
    expect(result.errors[0].message).toContain("楽天証券 / S&P500");
    expect(result.errors[1]).toMatchObject({ row: 3 });
    expect(result.errors[1].message).toContain("「abc」");
  });

  it("見出しがない・年月の列がない場合は取り込めない", () => {
    expect(readSheet("銀行\t100", s).fatal).toContain("見出し");
    expect(readSheet("口座名\tメモ\t合計\n銀行\t普通預金\t1", s).fatal).toContain("年月の列");
  });

  it("同じ口座名・メモの内訳が複数あれば、上から順に割り当てる", () => {
    const dup = store([account("a1", "銀行", [holding("x1", "cash", "japan", "預金"), holding("x2", "cash", "japan", "預金")])]);
    const result = readSheet(tsv([["口座名", "メモ", "2026年1月"], ["銀行", "預金", "1"], ["銀行", "預金", "2"]]), dup);
    expect(result.changes.map((c) => [c.holdingId, c.value])).toEqual([
      ["x1", 1],
      ["x2", 2],
    ]);
  });

  it("セル内に改行・タブがある（\" で囲まれた）表も読める", () => {
    const rows = parseTsv('口座名\tメモ\n"銀行\n（メイン）"\t"a""b"');
    expect(rows).toEqual([
      ["口座名", "メモ"],
      ["銀行\n（メイン）", 'a"b'],
    ]);
  });

  it("取り込んだ変更は1回の操作でまとめて反映される", () => {
    const result = readSheet(tsv([["口座名", "メモ", "2026年5月", "2026年6月"], ["銀行", "普通預金", "1", "2"]]), s);
    const next = applyEditAction(s, { type: "setAmounts", changes: result.changes });
    expect(next.yearlyData[2026].monthlyAmounts[5]).toEqual({ h1: 1 });
    expect(next.yearlyData[2026].monthlyAmounts[6]).toEqual({ h1: 2 });
  });
});
