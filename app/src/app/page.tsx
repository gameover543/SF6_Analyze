import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <h1 className="text-4xl font-bold mb-4">SF6 Coach</h1>
      <p className="text-xl text-theme-muted mb-12">
        フレームデータ検索 × AI付きメモ帳で対戦力を上げる
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
          href="/memos"
          className="group block p-6 rounded-xl border border-theme-border hover:border-emerald-500/50 hover:bg-theme-panel/50 transition"
        >
          <h2 className="text-xl font-semibold mb-2 group-hover:text-emerald-400 transition">
            対戦メモ
          </h2>
          <p className="text-theme-muted text-sm">
            対戦中にサクッとメモ。キャラ別に整理して見返せる。
            AIに質問してフレームデータに基づくアドバイスも。
          </p>
        </Link>
      </div>
    </div>
  );
}
