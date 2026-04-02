/** キャラ詳細ページのローディング画面 */
export default function CharacterLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* パンくず */}
      <div className="h-4 w-40 bg-theme-raised rounded animate-pulse mb-6" />
      {/* タイトル */}
      <div className="h-8 w-32 bg-theme-raised rounded animate-pulse mb-6" />
      {/* テーブルスケルトン */}
      <div className="space-y-2">
        {/* ヘッダー行 */}
        <div className="h-10 bg-theme-raised rounded animate-pulse" />
        {/* データ行 */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="h-9 bg-theme-raised/60 rounded animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
