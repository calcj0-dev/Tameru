/*
 * TAMERU Service Worker
 * データは LocalStorage にあるため、アプリ本体（HTML / JS / CSS / フォント / アイコン）を
 * キャッシュすればオフラインでも全機能が使える。
 *
 * - ページ（HTML）: ネットワーク優先 → オフライン時はキャッシュ（更新をすぐ反映するため）
 * - /_next/static/*: キャッシュ優先（ファイル名にハッシュが付いており内容が変わらないため）
 * - その他の同一オリジンの GET: キャッシュを返しつつ裏で更新（stale-while-revalidate）
 */

const VERSION = "v2";
const PAGE_CACHE = `tameru-pages-${VERSION}`;
const STATIC_CACHE = `tameru-static-${VERSION}`;
const ASSET_CACHE = `tameru-assets-${VERSION}`;
const CACHES = [PAGE_CACHE, STATIC_CACHE, ASSET_CACHE];
const MAX_STATIC_ENTRIES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("tameru-") && !CACHES.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Firebase のログイン処理（/__/auth, /__/firebase）はキャッシュせず常にネットワークへ
  if (url.pathname.startsWith("/__/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (!url.pathname.startsWith("/_next/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** トップページと、その HTML が参照する静的ファイルを事前にキャッシュする */
async function precacheAppShell() {
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.clone().text();
    const pageCache = await caches.open(PAGE_CACHE);
    await pageCache.put("/", res);

    const assets = new Set(["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]);
    for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(m[1]);
    const staticCache = await caches.open(STATIC_CACHE);
    const assetCache = await caches.open(ASSET_CACHE);
    await Promise.all(
      [...assets].map(async (path) => {
        try {
          const r = await fetch(path);
          if (r.ok) await (path.startsWith("/_next/static/") ? staticCache : assetCache).put(path, r);
        } catch {
          // 取得できないものは実行時にキャッシュされる
        }
      }),
    );
  } catch {
    // オフラインでのインストール等。次回オンライン時に実行時キャッシュされる
  }
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("/")) ||
      new Response("オフラインです", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trimCache(cache, MAX_STATIC_ENTRIES);
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || new Response("", { status: 504 });
}

/** 古いビルドのファイルが溜まり続けないよう、古いものから削除する */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
