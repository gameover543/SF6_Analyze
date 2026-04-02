import Link from "next/link";

/** 404 ページ */
export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <p className="text-6xl font-bold text-theme-accent-blue mb-4">404</p>
      <h1 className="text-xl font-semibold mb-2">ページが見つかりません</h1>
      <p className="text-theme-muted text-sm mb-8">
        お探しのページは移動または削除された可能性があります。
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-theme-accent-blue text-theme-page text-sm font-medium hover:opacity-90 transition"
        >
          トップへ戻る
        </Link>
        <Link
          href="/frames"
          className="px-4 py-2 rounded-lg border border-theme-border text-sm hover:bg-theme-panel transition"
        >
          フレームデータ
        </Link>
      </div>
    </div>
  );
}
