"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TameruStore } from "@/types/asset";
import type { CloudSync, InitialChoice, InitialChoiceSummary, SyncState } from "@/lib/sync/cloudSync";
import { clearBackup, loadBackup, saveBackup, type SyncBackup } from "@/lib/sync/backup";
import { clearLastSyncMeta, shouldBootSync } from "@/lib/sync/syncMeta";
import { createInitialStore } from "@/lib/storage";

const SIGNED_OUT: SyncState = { status: "signed-out", email: null, syncedAt: null, error: null };

export interface InitialChoiceRequest extends InitialChoiceSummary {
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
  // Firebase の読み込みが終わったか（ログインボタンを押せる状態か）
  const [ready, setReady] = useState(false);
  const [initialChoice, setInitialChoice] = useState<InitialChoiceRequest | null>(null);
  // 同期で置き換える前のバックアップ（最新1件）。画面はマウント後にしか描画しないので、初期化時に読み込んでよい
  const [backup, setBackup] = useState<SyncBackup | null>(() => (typeof window === "undefined" ? null : loadBackup()));
  // この操作中に作られたバックアップ（「元に戻せます」の案内を出す）
  const [backupNotice, setBackupNotice] = useState<SyncBackup | null>(null);
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
          onBackup: (b) => {
            setBackup(b);
            setBackupNotice(b);
          },
        });
        engine.start();
        engineRef.current = engine;
        setReady(true);
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

  /**
   * ログアウト。clearLocal=true（共有の PC 向け）は、この端末のデータ・バックアップ・同期の記録も消す。
   * クラウドのデータは消さない（未送信の変更は送ってからログアウトする）。
   */
  const signOut = useCallback(async ({ clearLocal = false }: { clearLocal?: boolean } = {}) => {
    await engineRef.current?.signOut({ forgetDevice: clearLocal });
    if (clearLocal) {
      const fresh = createInitialStore();
      storeRef.current = fresh;
      replaceRef.current(fresh);
      clearBackup();
      clearLastSyncMeta();
      setBackup(null);
      setBackupNotice(null);
    }
  }, []);

  /** 同期をやめて、クラウドのデータと TAMERU のログイン登録を削除（Google アカウントとこの端末のデータは残る） */
  const deleteAccount = useCallback(async () => {
    await engineRef.current?.deleteAccount();
  }, []);

  /**
   * バックアップから戻す。戻す前の今のデータも新たにバックアップするので、もう一度押せば元に戻せる。
   * ログイン中なら、戻したデータがそのまま同期される。
   */
  const restoreBackup = useCallback(() => {
    const target = loadBackup();
    if (!target) return;
    const before = saveBackup("before-restore", storeRef.current);
    storeRef.current = target.store;
    replaceRef.current(target.store);
    setBackup(before);
    setBackupNotice(null);
  }, []);

  const dismissBackupNotice = useCallback(() => setBackupNotice(null), []);

  return {
    state,
    ready,
    initialChoice,
    backup,
    backupNotice,
    prepare,
    signIn,
    signOut,
    deleteAccount,
    restoreBackup,
    dismissBackupNotice,
  };
}
