"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TameruStore } from "@/types/asset";
import type { CloudSync, InitialChoice, SyncState } from "@/lib/sync/cloudSync";
import { shouldBootSync } from "@/lib/sync/syncMeta";

const SIGNED_OUT: SyncState = { status: "signed-out", email: null, syncedAt: null, error: null };

export interface InitialChoiceRequest {
  cloudUpdatedAt: string | null;
  resolve: (choice: InitialChoice) => void;
}

/**
 * クラウド同期の React 側の窓口。
 * Firebase は「同期中」または「ログイン操作をした」ときだけ動的に読み込む
 * （未ログインの人の初期表示を軽く保ち、Google へ通信もしない）。
 */
export function useCloudSync({
  store,
  isLoaded,
  replaceStore,
}: {
  store: TameruStore;
  isLoaded: boolean;
  replaceStore: (store: TameruStore) => void;
}) {
  const [state, setState] = useState<SyncState>(SIGNED_OUT);
  const [initialChoice, setInitialChoice] = useState<InitialChoiceRequest | null>(null);
  const engineRef = useRef<CloudSync | null>(null);
  const bootingRef = useRef<Promise<CloudSync> | null>(null);
  const storeRef = useRef(store);
  const replaceRef = useRef(replaceStore);

  useEffect(() => {
    storeRef.current = store;
    replaceRef.current = replaceStore;
  });

  const boot = useCallback((): Promise<CloudSync> => {
    if (engineRef.current) return Promise.resolve(engineRef.current);
    if (!bootingRef.current) {
      bootingRef.current = import("@/lib/sync/cloudSync").then(({ CloudSync }) => {
        const engine = new CloudSync({
          getLocal: () => storeRef.current,
          applyRemote: (s) => {
            storeRef.current = s;
            replaceRef.current(s);
          },
          onState: (s) => setState(s),
          askInitialChoice: (summary) =>
            new Promise<InitialChoice>((resolve) =>
              setInitialChoice({
                ...summary,
                resolve: (choice) => {
                  setInitialChoice(null);
                  resolve(choice);
                },
              }),
            ),
        });
        engine.start();
        engineRef.current = engine;
        return engine;
      });
    }
    return bootingRef.current;
  }, []);

  // 同期中の端末・ログインから戻ってきた端末は、起動時に同期を再開
  useEffect(() => {
    if (!isLoaded || !shouldBootSync()) return;
    void boot();
  }, [isLoaded, boot]);

  // データが変わったらクラウドへ送る（エンジン側で少し待ってまとめて送信）
  useEffect(() => {
    engineRef.current?.notifyLocalChange();
  }, [store]);

  // 画面を閉じる・裏に回すときは未送信分をすぐ送る
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void engineRef.current?.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => () => engineRef.current?.dispose(), []);

  /**
   * ログインの準備（Firebase の読み込み）を先に始める。ログインボタンに触れた時点で呼ぶ。
   * ポップアップはボタン操作の直後でないとブロックされるため、押した瞬間に読み込みが済んでいるようにする
   */
  const prepare = useCallback(() => {
    void boot();
  }, [boot]);

  const signIn = useCallback(async () => {
    setState((s) => ({ ...s, status: "connecting", error: null }));
    const engine = await boot();
    await engine.signIn();
  }, [boot]);

  const signOut = useCallback(async () => {
    await engineRef.current?.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    await engineRef.current?.deleteAccount();
  }, []);

  return { state, initialChoice, prepare, signIn, signOut, deleteAccount };
}
