/**
 * ナレッジハイライトコンポーネント
 *
 * キャラクター詳細ページに、動画ナレッジの要点と人気カテゴリを表示する。
 * コーチング機能への導線として機能する Server Component。
 * ナレッジデータが存在しない場合は何も表示しない。
 */

import fs from "fs";
import path from "path";
import Link from "next/link";

// --- 定数 ---

const KNOWLEDGE_DIR = fs.existsSync(path.join(process.cwd(), "data", "knowledge"))
  ? path.join(process.cwd(), "data", "knowledge")
  : path.join(process.cwd(), "..", "data", "knowledge");

/** カテゴリ名の日本語ラベル */
const CATEGORY_LABELS: Record<string, string> = {
  general: "全般",
  combo: "コンボ",
  neutral: "立ち回り",
  oki: "起き攻め",
  matchup: "マッチアップ",
  defense: "防御",
};

/** フレームデータslug → ナレッジデータslugの変換（一致するものはそのまま） */
const FRAME_TO_KNOWLEDGE_SLUG: Record<string, string> = {
  ehonda: "honda",
};

// --- データ読み込み ---

interface KnowledgeEntry {
  category: string;
}

interface KnowledgeData {
  entries: KnowledgeEntry[];
  source_video_count: number;
}

interface DigestManifest {
  digests: Record<string, { file: string; chars: number }>;
}

/** フレームデータslugをナレッジslugに変換 */
function toKnowledgeSlug(frameSlug: string): string {
  return FRAME_TO_KNOWLEDGE_SLUG[frameSlug] ?? frameSlug;
}

/** カテゴリ別エントリ数を集計（降順上位3件） */
function getTopCategories(
  entries: KnowledgeEntry[]
): Array<{ category: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));
}

/** ダイジェストファイルから最初のパラグラフ（概要文）を抽出 */
function extractDigestIntro(digestPath: string): string | null {
  try {
    const content = fs.readFileSync(digestPath, "utf-8");
    // 最初の非空行かつマークダウン記法でない行を取得
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.startsWith("*")) {
        // 長すぎる場合は切り詰める
        return trimmed.length > 150 ? trimmed.slice(0, 150) + "…" : trimmed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface KnowledgeHighlightData {
  topCategories: Array<{ category: string; count: number }>;
  totalEntries: number;
  sourceVideoCount: number;
  digestIntro: string | null;
}

function loadKnowledgeHighlight(
  frameSlug: string
): KnowledgeHighlightData | null {
  try {
    const knowledgeSlug = toKnowledgeSlug(frameSlug);

    // ナレッジJSONを読み込み
    const knowledgePath = path.join(KNOWLEDGE_DIR, `${knowledgeSlug}.json`);
    if (!fs.existsSync(knowledgePath)) return null;

    const data: KnowledgeData = JSON.parse(
      fs.readFileSync(knowledgePath, "utf-8")
    );
    if (!data.entries || data.entries.length === 0) return null;

    // ダイジェストを読み込み（存在すれば）
    const manifestPath = path.join(KNOWLEDGE_DIR, "_digests", "_manifest.json");
    let digestIntro: string | null = null;
    if (fs.existsSync(manifestPath)) {
      const manifest: DigestManifest = JSON.parse(
        fs.readFileSync(manifestPath, "utf-8")
      );
      const digestInfo = manifest.digests[knowledgeSlug];
      if (digestInfo) {
        const digestPath = path.join(
          KNOWLEDGE_DIR,
          "_digests",
          digestInfo.file
        );
        digestIntro = extractDigestIntro(digestPath);
      }
    }

    return {
      topCategories: getTopCategories(data.entries),
      totalEntries: data.entries.length,
      sourceVideoCount: data.source_video_count ?? 0,
      digestIntro,
    };
  } catch {
    return null;
  }
}

// --- コンポーネント ---

interface KnowledgeHighlightProps {
  slug: string;
  charName: string;
}

export default function KnowledgeHighlight({
  slug,
  charName,
}: KnowledgeHighlightProps) {
  const data = loadKnowledgeHighlight(slug);

  // ナレッジなし or ダイジェスト概要がないキャラは非表示
  if (!data || !data.digestIntro) return null;

  return (
    <div className="mb-8 rounded-lg border border-blue-600/30 bg-blue-500/5 p-5">
      {/* ヘッダー */}
      <h2 className="text-base font-semibold text-theme-accent-blue mb-3">
        {charName} について
      </h2>

      {/* ダイジェスト概要 */}
      <p className="mb-4 text-sm text-theme-muted leading-relaxed">
        {data.digestIntro}
      </p>

      {/* トップカテゴリ */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {data.topCategories.map(({ category }) => (
            <span
              key={category}
              className="inline-flex items-center rounded-full border border-blue-600/30 bg-blue-500/10 px-3 py-1 text-xs text-theme-accent-blue"
            >
              {CATEGORY_LABELS[category] ?? category}
            </span>
          ))}
        </div>
      </div>

      {/* AIに質問する導線 */}
      <Link
        href={`/memos`}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
      >
        {charName} についてAIに質問する →
      </Link>
    </div>
  );
}
