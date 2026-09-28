"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { storeReducer, type HoldingPatch, type StoreState } from "@/lib/storeReducer";
import {
  createEmptyStore,
  createHolding,
  createInitialStore,
  generateId,
  localStorageAdapter,
  type StorageAdapter,
} from "@/lib/storage";

const INITIAL_STATE: StoreState = { store: createEmptyStore(), isLoaded: false };

/**
 * アプリ全体の状態と永続化を管理するフック。
 * - マウント後にストレージから読み込む（SSR時は isLoaded=false のままなので Hydration 差分が出ない）
 * - 変更のたびにアダプタへ保存
 */
export function useTameruStore(adapter: StorageAdapter = localStorageAdapter) {
  const [state, dispatch] = useReducer(storeReducer, INITIAL_STATE);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adapter
      .load()
      .catch(() => null)
      .then((loaded) => {
        if (!cancelled) dispatch({ type: "hydrate", store: loaded ?? createInitialStore() });
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  useEffect(() => {
    if (!state.isLoaded) return;
    adapter.save(state.store).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );
  }, [adapter, state.isLoaded, state.store]);

  const actions = useMemo(
    () => ({
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
    }),
    [],
  );

  return { store: state.store, isLoaded: state.isLoaded, saveError, ...actions };
}

export type TameruActions = Omit<ReturnType<typeof useTameruStore>, "store" | "isLoaded" | "saveError">;
