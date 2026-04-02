/** フレームデータ一覧のローディング画面 */
export default function FramesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-theme-raised rounded animate-pulse mb-6" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {[...Array(29)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-theme-raised rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
