import type { TameruStore } from "@/types/asset";
import { applyEditAction, type EditAction } from "@/lib/storeReducer";

/**
 * 入力表の下書き（編集中のデータ）と、元に戻す・やり直すの履歴。
 * 「保存」「キャンセル」で履歴はリセットされる。
 */
export interface DraftState {
  /** 編集中のデータ（null = 参照のみ） */
  draft: TameruStore | null;
  /** 編集を始めた時点のデータ（ここまで戻ったら「変更なし」） */
  base: TameruStore | null;
  /** 元に戻す用（古い順） */
  past: TameruStore[];
  /** やり直す用（新しい順に取り出す） */
  future: TameruStore[];
  /** 直前の操作のまとまり（同じセルへの連続入力は1回の操作として扱う） */
  lastGroup: string | null;
}

export type DraftAction =
  | { type: "start"; store: TameruStore }
  | { type: "stop" }
  | { type: "edit"; action: EditAction }
  | { type: "undo" }
  | { type: "redo" }
  /** 操作のまとまりを区切る（別のセルに移った等） */
  | { type: "boundary" };

/** 履歴の最大数（古いものから捨てる） */
const MAX_HISTORY = 200;

export const INITIAL_DRAFT: DraftState = { draft: null, base: null, past: [], future: [], lastGroup: null };

/**
 * 同じセル・同じ口座名・同じメモへの連続した入力は、1回の操作としてまとめる。
 * （1文字ごとに確定しているため、まとめないと「1500000」を戻すのに7回押すことになる）
 */
function groupOf(action: EditAction): string | null {
  switch (action.type) {
    case "setAmount":
      return `amount:${action.year}:${action.month}:${action.holdingId}`;
    case "renameAccount":
      return `name:${action.accountId}`;
    case "updateHolding":
      return action.patch.memo !== undefined && Object.keys(action.patch).length === 1 ? `memo:${action.holdingId}` : null;
    default:
      return null;
  }
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "start":
      return { ...INITIAL_DRAFT, draft: action.store, base: action.store };
    case "stop":
      return INITIAL_DRAFT;
    case "boundary":
      return state.lastGroup === null ? state : { ...state, lastGroup: null };
    case "edit": {
      if (!state.draft) return state;
      const next = applyEditAction(state.draft, action.action);
      if (next === state.draft) return state;
      const group = groupOf(action.action);
      const continuing = group !== null && group === state.lastGroup;
      return {
        ...state,
        draft: next,
        past: continuing ? state.past : [...state.past, state.draft].slice(-MAX_HISTORY),
        future: [],
        lastGroup: group,
      };
    }
    case "undo": {
      if (!state.draft || state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        draft: previous,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
        lastGroup: null,
      };
    }
    case "redo": {
      if (!state.draft || state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { ...state, draft: next, past: [...state.past, state.draft], future: rest, lastGroup: null };
    }
  }
}

/** 編集を始めた時点から変わっているか（全部戻したら false） */
export function isDirty(state: DraftState): boolean {
  return state.draft !== null && state.draft !== state.base;
}
