import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HeaderNav from "@/components/HeaderNav";
import MemoFab from "@/components/memo/MemoFab";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import Onboarding from "@/components/Onboarding";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sf6-coach.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "SF6 Coach - フレームデータ検索 × AI対戦メモ",
    template: "%s - SF6 Coach",
  },
  description:
    "ストリートファイター6の全29キャラのフレームデータを瞬時に検索。AIが対戦アドバイスをくれるメモ帳機能付き。Classic/Modern両対応。",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "SF6 Coach",
    title: "SF6 Coach - フレームデータ検索 × AI対戦メモ",
    description: "ストリートファイター6の全29キャラのフレームデータ検索とAI対戦アドバイス。",
  },
  twitter: {
    card: "summary_large_image",
    title: "SF6 Coach - フレームデータ検索 × AI対戦メモ",
    description: "ストリートファイター6の全29キャラのフレームデータ検索とAI対戦アドバイス。",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-theme-page text-theme-text">
        <ToastProvider>
          {/* ヘッダー（Client Component: 設定⚙ + テーマ切替） */}
          <header className="border-b border-theme-border bg-theme-page/80 backdrop-blur-sm sticky top-0 z-50">
            <HeaderNav />
          </header>

          {/* メインコンテンツ */}
          <main className="flex-1">{children}</main>

          {/* フッター（ディスクレーマー + リンク） */}
          <Footer />

          {/* 全ページ常駐FAB（メモ追加ボタン） */}
          <MemoFab />

          {/* 初回訪問オンボーディング */}
          <Onboarding />

          {/* キーボードショートカット（?キーでヘルプ表示） */}
          <KeyboardShortcuts />

          {/* アナリティクス・パフォーマンス計測 */}
          <Analytics />
          <SpeedInsights />
        </ToastProvider>
      </body>
    </html>
  );
}
