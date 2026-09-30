/**
 * Firebase Web アプリの設定値。
 * これらはブラウザに配信される前提の公開値で、秘密情報ではない（データの保護は Firestore のセキュリティルールで行う）。
 * https://firebase.google.com/docs/projects/api-keys
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDlcZIlTc5Ipwpfv4z3AEXFRk1m8Ce8ZzE",
  projectId: "tameru-dde4e",
  storageBucket: "tameru-dde4e.firebasestorage.app",
  messagingSenderId: "1031774071848",
  appId: "1:1031774071848:web:3bf1ab8d63e6ac70cc591d",
} as const;

/** Firebase 標準のログイン処理ドメイン（next.config.ts のリライト先） */
export const FIREBASE_AUTH_HOST = `${FIREBASE_CONFIG.projectId}.firebaseapp.com`;
