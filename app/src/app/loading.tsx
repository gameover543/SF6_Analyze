/** グローバルローディング画面 */
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* ヘッダースケルトン */}
      <div className="h-8 w-48 bg-theme-raised rounded animate-pulse mb-4" />
      <div className="h-4 w-80 bg-theme-raised rounded animate-pulse mb-8" />

      {/* コンテンツスケルトン */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-theme-raised rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
