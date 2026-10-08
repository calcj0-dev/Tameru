import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "TAMERU（タメル）| スプレッドシート感覚の資産管理";
const DESCRIPTION =
  "口座連携不要・無料で使える資産管理アプリ。毎月の資産を記録して、推移と内訳をグラフで確認。スプレッドシートからの移行も簡単です。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // SNS で共有したときのプレビュー（画像は app/opengraph-image.png）
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "TAMERU", locale: "ja_JP", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  applicationName: "TAMERU",
  // iOS: ホーム画面に追加したとき全画面（アドレスバーなし）で起動する
  appleWebApp: {
    capable: true,
    title: "TAMERU",
    statusBarStyle: "default",
  },
  // iOS Safari が金額（1,000,000 等）を電話番号として自動リンクしないように
  formatDetection: { telephone: false },
  // Next.js は標準の mobile-web-app-capable のみ出力するため、古い iOS 向けに従来のタグも出す
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        {/* アクセスの集計（Cookie を使わず、個人を特定しない） */}
        <Analytics />
      </body>
    </html>
  );
}
