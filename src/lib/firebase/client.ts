import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { FIREBASE_AUTH_HOST, FIREBASE_CONFIG } from "./config";

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

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
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
