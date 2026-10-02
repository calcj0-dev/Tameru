import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { FIREBASE_AUTH_HOST, FIREBASE_CONFIG } from "./config";

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/**
 * 自動テスト用: Firebase エミュレーター（手元で動く偽の Firebase）に接続するか。
 * テスト用のビルド（npm run test:e2e:sync）でのみ有効。本番のクラウドには一切接続しない。
 */
const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

/**
 * Firebase を初期化して返す（ブラウザ専用）。
 * このモジュールは同期を使う人だけが動的 import する（未ログインの人には Firebase を読み込ませない）。
 *
 * 本番（HTTPS）では authDomain をアプリ自身のドメインにし、/__/auth/* を firebaseapp.com へ中継する（next.config.ts）。
 * Safari 等のサードパーティ Cookie 制限下でもリダイレクト方式のログインが動くようにするため。
 * Firebase はログイン画面を必ず https://{authDomain} で開くため、http の開発環境（localhost）では標準ドメインを使う。
 */
export function getFirebase() {
  if (cached) return cached;
  const authDomain = window.location.protocol === "https:" ? window.location.host : FIREBASE_AUTH_HOST;
  const app = getApps().length > 0 ? getApp() : initializeApp({ ...FIREBASE_CONFIG, authDomain });
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  cached = { app, auth, db };
  return cached;
}
