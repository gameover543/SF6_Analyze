"use client";

/** グローバルエラーページ */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h1 className="text-xl font-semibold mb-2">エラーが発生しました</h1>
      <p className="text-theme-muted text-sm mb-8">
        {error.message || "予期しないエラーが発生しました。もう一度お試しください。"}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-theme-accent-blue text-theme-page text-sm font-medium hover:opacity-90 transition"
      >
        再試行
      </button>
    </div>
  );
}
