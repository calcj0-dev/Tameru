/** アプリのバージョン（package.json の version。next.config.ts でビルド時に埋め込む） */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

/** ビルドしたコミットの短縮ハッシュ（Vercel でのビルド時のみ。ローカルでは空） */
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "";
