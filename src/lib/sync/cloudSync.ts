import {
  GoogleAuthProvider,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import type { TameruStore } from "@/types/asset";
import { getFirebase } from "@/lib/firebase/client";
import { SCHEMA_VERSION, sanitizeStore } from "@/lib/storage";
import { hasNoAmounts, mergeStores, stableStringify } from "./merge";
import { clearSyncMeta, getDeviceId, loadSyncMeta, saveSyncMeta, setLoginPending, type SyncMeta } from "./syncMeta";

/**
 * クラウド同期エンジン（ローカルファースト）。
 *
 * Firestore: users/{uid} = { schemaVersion, rev, updatedAt, deviceId, payload }
 *   payload はデータ全体の JSON 文字列（将来の端末側暗号化もこの文字列を暗号化するだけで済む）
 *
 * - 受信: onSnapshot でリアルタイムに受け取り、この端末に未送信の変更があれば3者マージ
 * - 送信: 変更から少し待って送信。トランザクションで rev を確認し、他端末の更新があればマージしてから保存
 * - 新しい形式のデータ（schemaVersion が大きい）を見つけたら、古いアプリは保存を止めて更新を促す
 */

export type SyncStatus = "signed-out" | "connecting" | "syncing" | "synced" | "offline" | "error" | "outdated";

export interface SyncState {
  status: SyncStatus;
  email: string | null;
  syncedAt: string | null;
  error: string | null;
}

/** 初回接続時、この端末とクラウドの両方にデータがあるときの選択 */
export type InitialChoice = "cloud" | "device";

export interface CloudSyncCallbacks {
  getLocal: () => TameruStore;
  applyRemote: (store: TameruStore) => void;
  onState: (state: SyncState) => void;
  /** 両方にデータがある場合にユーザーへ選択を求める */
  askInitialChoice: (summary: { cloudUpdatedAt: string | null }) => Promise<InitialChoice>;
}

const PUSH_DELAY_MS = 1500;

interface RemoteDoc {
  rev: number;
  schemaVersion: number;
  payload: string;
  updatedAt: string | null;
}

export class CloudSync {
  private user: User | null = null;
  private meta: SyncMeta | null = null;
  private unsubscribeAuth: Unsubscribe | null = null;
  private unsubscribeDoc: Unsubscribe | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushing = false;
  private pushAgain = false;
  private ready = false; // 初回の突き合わせが終わったか
  private initializing = false;
  private pendingRemote: RemoteDoc | null = null;
  private blocked = false; // 新しい形式のデータがあるため保存しない
  private state: SyncState = { status: "connecting", email: null, syncedAt: null, error: null };

  constructor(private readonly cb: CloudSyncCallbacks) {}

  /** 起動: ログイン状態を監視し、ログイン済みなら同期を始める */
  start(): void {
    const { auth } = getFirebase();
    // リダイレクト方式のログインから戻った場合のエラーを拾う
    getRedirectResult(auth)
      .catch((e) => this.setState({ status: "error", error: authErrorMessage(e) }))
      .finally(() => setLoginPending(false));

    this.unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      this.stopDocListener();
      this.user = user;
      if (!user) {
        this.meta = null;
        clearSyncMeta();
        this.setState({ status: "signed-out", email: null, syncedAt: null, error: null });
        return;
      }
      const saved = loadSyncMeta();
      this.meta = saved && saved.uid === user.uid ? saved : null;
      this.ready = false;
      this.blocked = false;
      this.setState({ status: "connecting", email: user.email, syncedAt: this.meta?.syncedAt ?? null, error: null });
      this.listen(user.uid);
    });

    window.addEventListener("online", this.handleOnline);
  }

  dispose(): void {
    this.unsubscribeAuth?.();
    this.stopDocListener();
    if (this.pushTimer) clearTimeout(this.pushTimer);
    window.removeEventListener("online", this.handleOnline);
  }

  /** Google ログイン。PC はポップアップ、スマホ・ホーム画面アプリはリダイレクト */
  async signIn(): Promise<void> {
    const { auth } = getFirebase();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const preferRedirect =
      window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(display-mode: standalone)").matches;
    try {
      if (preferRedirect) {
        setLoginPending(true);
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = errorCode(e);
      if (code === "auth/popup-blocked") {
        setLoginPending(true);
        await signInWithRedirect(auth, provider);
        return;
      }
      setLoginPending(false);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      this.setState({ status: "error", error: authErrorMessage(e) });
    }
  }

  /** ログアウト（この端末のデータは残す） */
  async signOut(): Promise<void> {
    await this.flush();
    const { auth } = getFirebase();
    await signOut(auth);
  }

  /** クラウドのデータとアカウントを削除（この端末のデータは残す） */
  async deleteAccount(): Promise<void> {
    const user = this.user;
    if (!user) return;
    const { auth, db } = getFirebase();
    this.stopDocListener();
    await deleteDoc(doc(db, "users", user.uid));
    clearSyncMeta();
    this.meta = null;
    try {
      await deleteUser(user);
    } catch (e) {
      // 最近ログインしていないと削除できない（Firebase の安全策）。データは削除済みなのでログアウトだけ行う
      await signOut(auth);
      if (errorCode(e) === "auth/requires-recent-login") {
        throw new Error("クラウドのデータは削除しました。アカウント自体の削除は、もう一度ログインしてから実行してください。");
      }
      throw e;
    }
  }

  /** この端末でデータが変更された */
  notifyLocalChange(): void {
    if (!this.user || !this.ready || this.blocked) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.push(), PUSH_DELAY_MS);
  }

  /** 保留中の送信があればすぐ送る */
  async flush(): Promise<void> {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
      await this.push();
    }
  }

  // ---------------------------------------------------------------------------

  private handleOnline = () => {
    if (this.user && this.ready && !this.blocked) void this.push();
  };

  private listen(uid: string) {
    const { db } = getFirebase();
    this.unsubscribeDoc = onSnapshot(
      doc(db, "users", uid),
      (snap) => void this.handleSnapshot(snap),
      (e) => this.setState({ status: navigator.onLine ? "error" : "offline", error: firestoreErrorMessage(e) }),
    );
  }

  private stopDocListener() {
    this.unsubscribeDoc?.();
    this.unsubscribeDoc = null;
  }

  private async handleSnapshot(snap: DocumentSnapshot) {
    const user = this.user;
    if (!user) return;
    const remote = readRemote(snap);

    // 新しいバージョンのアプリが保存したデータ → このアプリでは扱わない
    if (remote && remote.schemaVersion > SCHEMA_VERSION) {
      this.blocked = true;
      this.setState({ status: "outdated", error: null });
      return;
    }

    if (!this.ready) {
      if (this.initializing) {
        // 初回の選択待ちの間に届いた更新は、選択後にまとめて取り込む
        this.pendingRemote = remote;
        return;
      }
      this.initializing = true;
      try {
        await this.initialize(user.uid, remote);
      } finally {
        this.initializing = false;
      }
      const pending = this.pendingRemote;
      this.pendingRemote = null;
      if (pending && this.ready) this.applyRemoteDoc(user.uid, pending);
      return;
    }

    if (remote) this.applyRemoteDoc(user.uid, remote);
  }

  /** クラウドの更新をこの端末に取り込む（未送信の変更があれば3者マージ） */
  private applyRemoteDoc(uid: string, remote: RemoteDoc) {
    if (!this.meta || remote.rev <= this.meta.rev) return; // 自分の保存の反映 or 古い通知
    const remoteStore = parseStore(remote.payload);
    if (!remoteStore) return;

    const local = this.cb.getLocal();
    const localJson = stableStringify(local);
    const next = localJson === this.meta.base ? remoteStore : mergeStores(parseStore(this.meta.base) ?? emptyStore(), local, remoteStore);
    this.saveMeta({ uid, rev: remote.rev, base: stableStringify(remoteStore) });
    this.cb.applyRemote(next);
    if (stableStringify(next) !== this.meta?.base) this.notifyLocalChange();
    else this.setState({ status: "synced", error: null });
  }

  /** ログイン直後の突き合わせ */
  private async initialize(uid: string, remote: RemoteDoc | null) {
    const local = this.cb.getLocal();

    if (!remote) {
      // クラウドが空 → この端末のデータをアップロード
      this.meta = { uid, rev: 0, base: "", syncedAt: null };
      this.ready = true;
      await this.push();
      return;
    }

    const remoteStore = parseStore(remote.payload);
    if (!remoteStore) {
      this.setState({ status: "error", error: "クラウドのデータを読み込めませんでした" });
      return;
    }
    const remoteJson = stableStringify(remoteStore);

    if (this.meta) {
      // 以前から同期している端末: 未送信の変更があればマージ
      this.ready = true;
      if (remote.rev === this.meta.rev) {
        await this.push(); // この端末の未送信分だけ送る（変更がなければ何もしない）
      } else {
        this.applyRemoteDoc(uid, remote);
      }
      return;
    }

    // この端末で初めて同期する
    let choice: InitialChoice = "cloud";
    if (!hasNoAmounts(local) && stableStringify(local) !== remoteJson) {
      choice = await this.cb.askInitialChoice({ cloudUpdatedAt: remote.updatedAt });
    }
    if (choice === "cloud") {
      this.saveMeta({ uid, rev: remote.rev, base: remoteJson });
      this.cb.applyRemote(remoteStore);
      this.ready = true;
      this.setState({ status: "synced", error: null });
    } else {
      // この端末のデータでクラウドを上書き（base = クラウドなので、マージせずそのまま保存される）
      this.meta = { uid, rev: remote.rev, base: remoteJson, syncedAt: null };
      this.ready = true;
      await this.push();
    }
  }

  private async push(): Promise<void> {
    this.pushTimer = null;
    const user = this.user;
    if (!user || !this.meta || this.blocked) return;
    if (this.pushing) {
      this.pushAgain = true;
      return;
    }
    const local = this.cb.getLocal();
    const localJson = stableStringify(local);
    if (localJson === this.meta.base) {
      this.setState({ status: "synced", error: null });
      return;
    }
    if (!navigator.onLine) {
      this.setState({ status: "offline", error: null });
      return;
    }

    this.pushing = true;
    this.setState({ status: "syncing", error: null });
    const { db } = getFirebase();
    const ref = doc(db, "users", user.uid);
    const meta = this.meta;
    try {
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const remote = readRemote(snap);
        let toWrite = local;
        if (remote) {
          if (remote.schemaVersion > SCHEMA_VERSION) throw new OutdatedError();
          if (remote.rev !== meta.rev) {
            // 他の端末が先に保存していた → マージしてから保存
            const remoteStore = parseStore(remote.payload) ?? emptyStore();
            toWrite = mergeStores(parseStore(meta.base) ?? emptyStore(), local, remoteStore);
          }
        }
        const rev = (remote?.rev ?? 0) + 1;
        const payload = stableStringify(toWrite);
        tx.set(ref, { schemaVersion: SCHEMA_VERSION, rev, updatedAt: serverTimestamp(), deviceId: getDeviceId(), payload });
        return { rev, payload, toWrite };
      });
      this.saveMeta({ uid: user.uid, rev: result.rev, base: result.payload });
      if (result.toWrite !== local) this.cb.applyRemote(result.toWrite);
      this.setState({ status: "synced", error: null });
    } catch (e) {
      if (e instanceof OutdatedError) {
        this.blocked = true;
        this.setState({ status: "outdated", error: null });
      } else {
        this.setState({ status: navigator.onLine ? "error" : "offline", error: firestoreErrorMessage(e) });
      }
    } finally {
      this.pushing = false;
      if (this.pushAgain) {
        this.pushAgain = false;
        void this.push();
      }
    }
  }

  private saveMeta(meta: Omit<SyncMeta, "syncedAt">) {
    const syncedAt = new Date().toISOString();
    this.meta = { ...meta, syncedAt };
    saveSyncMeta(this.meta);
    this.state = { ...this.state, syncedAt };
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.cb.onState(this.state);
  }
}

class OutdatedError extends Error {}

function readRemote(snap: DocumentSnapshot): RemoteDoc | null {
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.rev !== "number" || typeof d.payload !== "string") return null;
  const ts = d.updatedAt as { toDate?: () => Date } | null | undefined;
  return {
    rev: d.rev,
    schemaVersion: typeof d.schemaVersion === "number" ? d.schemaVersion : 0,
    payload: d.payload,
    updatedAt: ts?.toDate ? ts.toDate().toISOString() : null,
  };
}

function parseStore(payload: string): TameruStore | null {
  try {
    return sanitizeStore(JSON.parse(payload));
  } catch {
    return null;
  }
}

function emptyStore(): TameruStore {
  return { accounts: [], yearlyData: {} };
}

function errorCode(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
}

function authErrorMessage(e: unknown): string {
  switch (errorCode(e)) {
    case "auth/network-request-failed":
      return "通信できませんでした。ネットワークを確認してください";
    case "auth/unauthorized-domain":
      return "このドメインはログインが許可されていません（Firebase の承認済みドメインを確認してください）";
    case "auth/too-many-requests":
      return "しばらく時間をおいてから再度お試しください";
    default:
      return "ログインに失敗しました";
  }
}

function firestoreErrorMessage(e: unknown): string {
  switch (errorCode(e)) {
    case "permission-denied":
      return "クラウドへのアクセスが拒否されました";
    case "unavailable":
      return "通信できませんでした。オンラインになったら自動で同期します";
    case "resource-exhausted":
      return "クラウドの利用上限に達しました。しばらくしてから同期されます";
    default:
      return "同期に失敗しました";
  }
}
