"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { storeReducer, type StoreState } from "@/lib/storeReducer";
import {
  createEmptyStore,
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
      addCategory(name = ""): string {
        const id = generateId();
        dispatch({ type: "addCategory", category: { id, name } });
        return id;
      },
      renameCategory(id: string, name: string) {
        dispatch({ type: "renameCategory", id, name });
      },
      removeCategory(id: string) {
        dispatch({ type: "removeCategory", id });
      },
      setAmount(year: number, month: number, categoryId: string, value: number | null) {
        dispatch({ type: "setAmount", year, month, categoryId, value });
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
