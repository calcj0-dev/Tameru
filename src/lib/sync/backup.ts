import type { TameruStore } from "@/types/asset";
import { sanitizeStore } from "@/lib/storage";

/**
 * 同期でデータを置き換える直前のバックアップ（この端末の LocalStorage に最新1件だけ保存）。
 * 「直前のデータに戻す」で復元できる。Firebase を読み込まずに使える軽量モジュール。
 */
export type BackupReason =
  | "device-replaced" // クラウドのデータを使うため、この端末のデータを置き換えた
  | "cloud-replaced" // この端末のデータでクラウドを上書きした（上書き前のクラウドのデータ）
  | "before-restore"; // バックアップから戻す前のデータ

export interface SyncBackup {
  reason: BackupReason;
  createdAt: string;
  store: TameruStore;
}

const BACKUP_KEY = "tameru:sync-backup";

export function saveBackup(reason: BackupReason, store: TameruStore): SyncBackup {
  const backup: SyncBackup = { reason, createdAt: new Date().toISOString(), store };
  try {
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // 容量不足等。バックアップできなくても処理は続ける
  }
  return backup;
}

export function loadBackup(): SyncBackup | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SyncBackup>;
    const store = sanitizeStore(v.store);
    if (!store || typeof v.createdAt !== "string" || typeof v.reason !== "string") return null;
    return { reason: v.reason as BackupReason, createdAt: v.createdAt, store };
  } catch {
    return null;
  }
}

export function clearBackup(): void {
  try {
    window.localStorage.removeItem(BACKUP_KEY);
  } catch {
    // noop
  }
}

/** バックアップの説明文 */
export function describeBackup(backup: SyncBackup): string {
  const at = new Date(backup.createdAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  switch (backup.reason) {
    case "device-replaced":
      return `${at} にクラウドのデータへ置き換える前の、この端末のデータ`;
    case "cloud-replaced":
      return `${at} にこの端末のデータで上書きする前の、クラウドのデータ`;
    case "before-restore":
      return `${at} にバックアップから戻す前のデータ`;
  }
}
