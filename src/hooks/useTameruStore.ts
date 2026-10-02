"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import type { TameruStore } from "@/types/asset";
import { storeReducer, type StoreState } from "@/lib/storeReducer";
import { createEmptyStore, createInitialStore, localStorageAdapter, type StorageAdapter } from "@/lib/storage";

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

  /** データ全体を置き換える（入力表の「保存」・クラウド同期で使う） */
  const replaceStore = useCallback((store: TameruStore) => dispatch({ type: "replace", store }), []);

  return { store: state.store, isLoaded: state.isLoaded, saveError, replaceStore };
}
