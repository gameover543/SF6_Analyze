import Link from "next/link";
import type { Metadata } from "next";
import { CHARACTER_LIST } from "@/lib/frame-data";

export const metadata: Metadata = {
  title: "フレームデータ一覧",
  description:
    "ストリートファイター6の全29キャラのフレームデータ一覧。キャラを選んで発生・硬直差・ダメージを検索。",
};

export default function FramesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">フレームデータ</h1>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {CHARACTER_LIST.map((char) => (
          <Link
            key={char.slug}
            href={`/frames/${char.slug}`}
            className="flex items-center justify-center p-3 rounded-lg border border-theme-border hover:border-blue-500/50 hover:bg-theme-panel/50 transition text-sm font-medium text-center"
          >
            {char.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
