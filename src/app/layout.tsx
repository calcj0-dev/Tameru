import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TAMERU（タメル）| 資産管理",
  description: "スプレッドシート感覚で資産と推移を積み上げる、口座連携不要・プライバシー重視の資産管理アプリ",
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
