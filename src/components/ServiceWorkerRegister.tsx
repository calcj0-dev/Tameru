"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録する（オフライン起動・ホーム画面アプリ化のため）。
 * 開発中はキャッシュで古い画面が表示されると紛らわしいため、本番ビルドのみ有効。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // 登録に失敗してもアプリ自体は通常どおり使える
    });
  }, []);
  return null;
}
