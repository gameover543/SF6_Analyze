/** メモページのローディング画面 */
export default function MemosLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-8 w-32 bg-theme-raised rounded animate-pulse mb-6" />
      {/* AI質問欄スケルトン */}
      <div className="h-11 bg-theme-raised rounded-lg animate-pulse mb-6" />
      {/* メモカードスケルトン */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-theme-raised rounded-lg animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
