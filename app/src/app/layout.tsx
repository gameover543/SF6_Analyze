import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HeaderNav from "@/components/HeaderNav";
import MemoFab from "@/components/memo/MemoFab";
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
  title: "SF6 Coach - AIフレームデータアシスタント",
  description:
    "ストリートファイター6のフレームデータ検索とAIコーチング",
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
        {/* ヘッダー（Client Component: 設定⚙ + テーマ切替） */}
        <header className="border-b border-theme-border bg-theme-page/80 backdrop-blur-sm sticky top-0 z-50">
          <HeaderNav />
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1">{children}</main>

        {/* 全ページ常駐FAB（メモ追加ボタン） */}
        <MemoFab />
      </body>
    </html>
  );
}
