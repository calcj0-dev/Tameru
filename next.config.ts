import type { NextConfig } from "next";
import packageJson from "./package.json";
import { FIREBASE_AUTH_HOST } from "./src/lib/firebase/config";

const nextConfig: NextConfig = {
  // 自動テスト（エミュレーター用ビルド）は別のフォルダに出力し、通常のビルドを上書きしない
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 画面に表示するバージョン（package.json の version）と、Vercel でビルドしたコミット（短縮）
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },
  // Firebase のログイン処理（/__/auth/*）を自分のドメイン経由で中継する。
  // ログインと同じドメインで完結させ、Safari 等のサードパーティ Cookie 制限でもリダイレクトログインが動くようにする。
  async rewrites() {
    return [
      { source: "/__/auth/:path*", destination: `https://${FIREBASE_AUTH_HOST}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${FIREBASE_AUTH_HOST}/__/firebase/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Service Worker 自体はキャッシュさせない（更新をすぐ反映するため）
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
