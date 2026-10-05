import { describe, expect, it } from "vitest";
import { draftReducer, INITIAL_DRAFT, isDirty, type DraftAction, type DraftState } from "@/lib/draftHistory";
import { sampleAccounts, store } from "./helpers";

const saved = store(sampleAccounts(), { "2026-01": { h1: 100 } });
const setAmount = (holdingId: string, value: number, month = 1): DraftAction => ({
  type: "edit",
  action: { type: "setAmount", year: 2026, month, holdingId, value },
});
const run = (actions: DraftAction[], state: DraftState = draftReducer(INITIAL_DRAFT, { type: "start", store: saved })) =>
  actions.reduce(draftReducer, state);
const amount = (s: DraftState, holdingId: string, month = 1) =>
  s.draft?.yearlyData[2026]?.monthlyAmounts[month]?.[holdingId];

describe("元に戻す・やり直す", () => {
  it("編集を始めた直後は、戻すもやり直すもない・変更なし", () => {
    const s = run([]);
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
    expect(isDirty(s)).toBe(false);
  });

  it("別々のセルへの入力は、1つずつ戻せて、やり直せる", () => {
    const s = run([setAmount("h1", 200), { type: "boundary" }, setAmount("h2", 300)]);
    const undo1 = draftReducer(s, { type: "undo" });
    expect(amount(undo1, "h2")).toBeUndefined();
    expect(amount(undo1, "h1")).toBe(200);
    const undo2 = draftReducer(undo1, { type: "undo" });
    expect(amount(undo2, "h1")).toBe(100);
    const redo = draftReducer(undo2, { type: "redo" });
    expect(amount(redo, "h1")).toBe(200);
  });

  it("同じセルへの連続入力（1文字ごとの確定）は、1回で戻る", () => {
    const s = run([setAmount("h1", 1), setAmount("h1", 15), setAmount("h1", 150), setAmount("h1", 1500)]);
    expect(s.past).toHaveLength(1);
    expect(amount(draftReducer(s, { type: "undo" }), "h1")).toBe(100);
  });

  it("同じセルでも、一度離れてから再入力したら別の操作になる", () => {
    const s = run([setAmount("h1", 200), { type: "boundary" }, setAmount("h1", 300)]);
    expect(s.past).toHaveLength(2);
    expect(amount(draftReducer(s, { type: "undo" }), "h1")).toBe(200);
  });

  it("戻したあとに新しく入力すると、やり直すの履歴は消える", () => {
    const s = run([setAmount("h1", 200), { type: "undo" }, setAmount("h2", 5)]);
    expect(s.future).toHaveLength(0);
    expect(draftReducer(s, { type: "redo" })).toBe(s); // 何も起きない
  });

  it("口座の追加・削除・前月コピーも戻せる", () => {
    const s = run([
      { type: "edit", action: { type: "removeAccount", accountId: "a2" } },
      { type: "edit", action: { type: "copyPreviousMonth", year: 2026, month: 2 } },
    ]);
    const undone = draftReducer(draftReducer(s, { type: "undo" }), { type: "undo" });
    expect(undone.draft?.accounts.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("最初の状態まで全部戻すと「変更なし」になる（キャンセル時の確認が出ない）", () => {
    const s = run([setAmount("h1", 200), { type: "boundary" }, setAmount("h2", 300)]);
    expect(isDirty(s)).toBe(true);
    const back = draftReducer(draftReducer(s, { type: "undo" }), { type: "undo" });
    expect(isDirty(back)).toBe(false);
  });

  it("保存・キャンセル（stop）で履歴はリセットされる", () => {
    const s = run([setAmount("h1", 200), { type: "stop" }]);
    expect(s).toEqual(INITIAL_DRAFT);
  });

  it("値が変わらない操作は履歴に積まない", () => {
    const s = run([setAmount("h1", 100)]);
    expect(s.past).toHaveLength(0);
  });
});
