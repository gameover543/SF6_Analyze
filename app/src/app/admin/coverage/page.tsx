/**
 * 管理者向け: ナレッジカバレッジダッシュボード
 *
 * _coverage.json と _index.json のデータを可視化する。
 * - キャラ別ナレッジ件数・カテゴリ分布
 * - 動画信頼度スコア分布
 * - 最終更新日・総件数サマリー
 */

import fs from "fs";
import path from "path";

// --- 型定義 ---

interface CategoryCounts {
  neutral?: number;
  defense?: number;
  general?: number;
  matchup?: number;
  oki?: number;
  combo?: number;
}

interface CoverageData {
  matrix: Record<string, CategoryCounts>;
  total_entries: number;
  total_videos: number;
  gap_queries: string[];
  last_updated: string;
}

interface VideoEntry {
  video_id: string;
  status: string;
  credibility_score: number;
}

interface IndexData {
  videos: VideoEntry[];
}

// --- 定数 ---

const KNOWLEDGE_DIR = path.join(process.cwd(), "..", "data", "knowledge");

const CATEGORIES = ["combo", "neutral", "oki", "defense", "matchup", "general"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  combo: "コンボ",
  neutral: "立ち回り",
  oki: "起き攻め",
  defense: "守り",
  matchup: "マッチアップ",
  general: "基礎",
};

const CATEGORY_COLORS: Record<Category, string> = {
  combo: "#3b82f6",    // blue
  neutral: "#22c55e",  // green
  oki: "#eab308",      // yellow
  defense: "#ef4444",  // red
  matchup: "#a855f7",  // purple
  general: "#6b7280",  // gray
};

// slug → 日本語名（_coverage.json は "honda" を使うため "ehonda" は含まない）
const CHAR_NAME: Record<string, string> = {
  ryu: "リュウ", luke: "ルーク", jamie: "ジェイミー", chunli: "春麗",
  guile: "ガイル", kimberly: "キンバリー", juri: "ジュリ", ken: "ケン",
  blanka: "ブランカ", dhalsim: "ダルシム", honda: "本田", deejay: "ディージェイ",
  manon: "マノン", marisa: "マリーザ", jp: "JP", zangief: "ザンギエフ",
  lily: "リリー", cammy: "キャミィ", rashid: "ラシード", aki: "アキ",
  ed: "エド", gouki: "豪鬼", mbison: "ベガ", terry: "テリー",
  mai: "舞", elena: "エレナ", cviper: "バイパー", sagat: "サガット",
  alex: "アレックス",
};

// --- ページコンポーネント ---

export default function CoveragePage() {
  // サーバーサイドでデータを読み込む
  const coverage = JSON.parse(
    fs.readFileSync(path.join(KNOWLEDGE_DIR, "_coverage.json"), "utf-8")
  ) as CoverageData;

  const indexData = JSON.parse(
    fs.readFileSync(path.join(KNOWLEDGE_DIR, "_index.json"), "utf-8")
  ) as IndexData;

  // キャラ別合計を計算し、合計件数の降順でソート
  const charStats = Object.entries(coverage.matrix)
    .map(([slug, cats]) => {
      const total = Object.values(cats).reduce((a, b) => a + b, 0);
      return { slug, name: CHAR_NAME[slug] ?? slug, cats, total };
    })
    .sort((a, b) => b.total - a.total);

  const maxCharTotal = Math.max(...charStats.map((c) => c.total), 1);

  // カテゴリ別合計
  const categoryTotals = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = charStats.reduce((sum, c) => sum + (c.cats[cat] ?? 0), 0);
      return acc;
    },
    {} as Record<Category, number>
  );
  const maxCatTotal = Math.max(...Object.values(categoryTotals), 1);

  // 動画信頼度スコアを 10 バケット（0.0〜1.0）に集計
  const completedVideos = indexData.videos.filter((v) => v.status === "completed");
  const credBuckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i * 0.1).toFixed(1)}`,
    count: 0,
  }));
  for (const video of completedVideos) {
    const idx = Math.min(Math.floor(video.credibility_score * 10), 9);
    credBuckets[idx].count++;
  }
  const maxCredCount = Math.max(...credBuckets.map((b) => b.count), 1);

  // 最終更新日時フォーマット
  const lastUpdated = new Date(coverage.last_updated).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">ナレッジカバレッジ</h1>
        <p className="text-sm text-gray-400">最終更新: {lastUpdated}</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <StatCard label="総ナレッジ件数" value={coverage.total_entries.toLocaleString()} />
        <StatCard label="処理済み動画" value={`${coverage.total_videos} 本`} />
        <StatCard
          label="カバレッジ対象キャラ"
          value={`${Object.keys(coverage.matrix).length} 体`}
        />
      </div>

      {/* カテゴリ別合計 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">カテゴリ別合計</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">{CATEGORY_LABELS[cat]}</span>
                <span className="font-mono font-bold">{categoryTotals[cat].toLocaleString()}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(categoryTotals[cat] / maxCatTotal) * 100}%`,
                    backgroundColor: CATEGORY_COLORS[cat],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 動画信頼度分布 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">動画信頼度分布</h2>
        <div className="bg-gray-900 rounded-lg p-5">
          {/* バーチャート */}
          <div className="flex items-end gap-1" style={{ height: "120px" }}>
            {credBuckets.map((bucket) => (
              <div key={bucket.range} className="flex-1 flex flex-col items-center justify-end gap-1">
                {bucket.count > 0 && (
                  <span className="text-xs text-gray-400">{bucket.count}</span>
                )}
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(bucket.count / maxCredCount) * 88}px`,
                    minHeight: bucket.count > 0 ? "4px" : "0px",
                    backgroundColor: "#3b82f6",
                    opacity: 0.7 + (bucket.count / maxCredCount) * 0.3,
                  }}
                />
              </div>
            ))}
          </div>
          {/* X軸ラベル */}
          <div className="flex gap-1 mt-1">
            {credBuckets.map((bucket) => (
              <div key={bucket.range} className="flex-1 text-center text-xs text-gray-500">
                {bucket.range}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 text-right">
            信頼度スコア（0.0〜1.0） / 完了動画: {completedVideos.length} 本
          </p>
        </div>
      </section>

      {/* キャラ別カバレッジ表 */}
      <section>
        <h2 className="text-lg font-semibold mb-4">キャラ別カバレッジ（合計降順）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left py-2 px-3 font-medium">キャラ</th>
                {CATEGORIES.map((cat) => (
                  <th key={cat} className="text-right py-2 px-2 font-medium whitespace-nowrap">
                    {CATEGORY_LABELS[cat]}
                  </th>
                ))}
                <th className="text-right py-2 px-3 font-medium">合計</th>
                <th className="py-2 px-3 font-medium" style={{ minWidth: "120px" }}></th>
              </tr>
            </thead>
            <tbody>
              {charStats.map((char) => (
                <tr
                  key={char.slug}
                  className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors"
                >
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{char.name}</td>
                  {CATEGORIES.map((cat) => (
                    <td
                      key={cat}
                      className="py-2 px-2 text-right font-mono text-gray-300"
                    >
                      {char.cats[cat] ?? 0}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-mono font-bold">
                    {char.total}
                  </td>
                  <td className="py-2 px-3">
                    <div className="h-2.5 bg-gray-700 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(char.total / maxCharTotal) * 100}%`,
                          backgroundColor: "#3b82f6",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// --- サブコンポーネント ---

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}
