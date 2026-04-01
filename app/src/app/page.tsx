import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <h1 className="text-4xl font-bold mb-4">SF6 Coach</h1>
      <p className="text-xl text-gray-400 mb-12">
        フレームデータ検索 × AIコーチングで上達をサポート
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/frames"
          className="group block p-6 rounded-xl border border-theme-border hover:border-blue-500/50 hover:bg-theme-panel/50 transition"
        >
          <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition">
            フレームデータ
          </h2>
          <p className="text-theme-muted text-sm">
            全29キャラのフレームデータを検索。Classic/Modern両対応。
            発生、硬直差、ダメージ、ゲージ情報まで完全網羅。
          </p>
        </Link>

        <Link
          href="/coach"
          className="group block p-6 rounded-xl border border-theme-border hover:border-green-500/50 hover:bg-theme-panel/50 transition"
        >
          <h2 className="text-xl font-semibold mb-2 group-hover:text-green-400 transition">
            AIコーチ
          </h2>
          <p className="text-theme-muted text-sm">
            フレームデータに基づいたAIコーチに質問。
            確反、対策、コンボ、立ち回りなど何でも聞ける。
          </p>
        </Link>
      </div>
    </div>
  );
}
