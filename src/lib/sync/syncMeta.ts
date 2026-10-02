/**
 * 同期の状態をこの端末に記録する（LocalStorage）。Firebase を読み込まずに参照できる軽量モジュール。
 * - uid: 同期中のユーザー
 * - rev: 最後に同期したクラウド側のリビジョン
 * - base: 最後に同期した時点のデータ（3者マージの基準。stableStringify した文字列）
 */
export interface SyncMeta {
  uid: string;
  rev: number;
  base: string;
  syncedAt: string | null;
}

const META_KEY = "tameru:sync";
const LOGIN_PENDING_KEY = "tameru:sync:login-pending";
const DEVICE_ID_KEY = "tameru:device-id";

export function loadSyncMeta(): SyncMeta | null {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SyncMeta>;
    if (typeof v.uid !== "string" || typeof v.rev !== "number" || typeof v.base !== "string") return null;
    return { uid: v.uid, rev: v.rev, base: v.base, syncedAt: typeof v.syncedAt === "string" ? v.syncedAt : null };
  } catch {
    return null;
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function clearSyncMeta(): void {
  window.localStorage.removeItem(META_KEY);
}

/** ログイン（リダイレクト）中の目印。戻ってきた時に Firebase を読み込むかの判定に使う */
export function setLoginPending(pending: boolean): void {
  if (pending) window.localStorage.setItem(LOGIN_PENDING_KEY, "1");
  else window.localStorage.removeItem(LOGIN_PENDING_KEY);
}

export function isLoginPending(): boolean {
  try {
    return window.localStorage.getItem(LOGIN_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** 起動時に Firebase を読み込む必要があるか（同期中 or ログイン途中） */
export function shouldBootSync(): boolean {
  try {
    return loadSyncMeta() !== null || window.localStorage.getItem(LOGIN_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** 端末ごとのランダムID（どの端末が最後に保存したかの記録用。個人情報は含まない） */
export function getDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}
