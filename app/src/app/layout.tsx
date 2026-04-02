import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import ThemeProvider from "@/components/ThemeProvider";
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
        {/* ヘッダー */}
        <header className="border-b border-theme-border bg-theme-page/80 backdrop-blur-sm sticky top-0 z-50">
          <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4 sm:gap-8">
            <Link href="/" className="text-base sm:text-lg font-bold text-theme-text shrink-0">
              SF6 Coach
            </Link>
            {/* ナビリンク: 小画面でも横スクロールして表示 */}
            <div className="flex gap-4 sm:gap-6 text-sm overflow-x-auto scrollbar-none flex-1">
              <Link
                href="/frames"
                className="text-theme-muted hover:text-theme-text transition shrink-0"
              >
                フレームデータ
              </Link>
              <Link
                href="/coach"
                className="text-theme-muted hover:text-theme-text transition shrink-0"
              >
                AIコーチ
              </Link>
              <Link
                href="/memos"
                className="text-theme-muted hover:text-theme-text transition shrink-0"
              >
                メモ
              </Link>
              <Link
                href="/admin/coverage"
                className="text-theme-subtle hover:text-theme-muted transition text-xs shrink-0 hidden sm:inline"
              >
                カバレッジ
              </Link>
            </div>
            {/* テーマ切替ボタン */}
            <ThemeProvider />
          </nav>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1">{children}</main>

        {/* 全ページ常駐FAB（メモ追加ボタン） */}
        <MemoFab />
      </body>
    </html>
  );
}
