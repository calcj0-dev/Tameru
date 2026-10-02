import type { EditAction, HoldingPatch } from "@/lib/storeReducer";
import { createHolding, generateId } from "@/lib/storage";

/**
 * 入力表の編集操作。dispatch 先を差し替えられるようにして、本データ・下書きのどちらにも使う。
 */
export function createEditActions(dispatch: (action: EditAction) => void) {
  return {
    /** 口座を追加（内訳を1件含む）。追加した口座のIDを返す */
    addAccount(name = ""): string {
      const id = generateId("acc");
      dispatch({ type: "addAccount", account: { id, name, holdings: [createHolding()] } });
      return id;
    },
    renameAccount(accountId: string, name: string) {
      dispatch({ type: "renameAccount", accountId, name });
    },
    removeAccount(accountId: string) {
      dispatch({ type: "removeAccount", accountId });
    },
    /** 内訳を追加。追加した内訳のIDを返す */
    addHolding(accountId: string): string {
      const holding = createHolding();
      dispatch({ type: "addHolding", accountId, holding });
      return holding.id;
    },
    updateHolding(holdingId: string, patch: HoldingPatch) {
      dispatch({ type: "updateHolding", holdingId, patch });
    },
    removeHolding(holdingId: string) {
      dispatch({ type: "removeHolding", holdingId });
    },
    setAmount(year: number, month: number, holdingId: string, value: number | null) {
      dispatch({ type: "setAmount", year, month, holdingId, value });
    },
    copyPreviousMonth(year: number, month: number) {
      dispatch({ type: "copyPreviousMonth", year, month });
    },
  };
}

export type EditActions = ReturnType<typeof createEditActions>;
