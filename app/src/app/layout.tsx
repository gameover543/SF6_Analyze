import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        {/* ヘッダー */}
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
          <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
            <Link href="/" className="text-lg font-bold text-white">
              SF6 Coach
            </Link>
            <div className="flex gap-6 text-sm">
              <Link
                href="/frames"
                className="text-gray-400 hover:text-white transition"
              >
                フレームデータ
              </Link>
              <Link
                href="/coach"
                className="text-gray-400 hover:text-white transition"
              >
                AIコーチ
              </Link>
            </div>
          </nav>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
