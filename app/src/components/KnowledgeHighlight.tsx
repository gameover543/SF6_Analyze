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

/** AI前置き文パターン（概要として不適切な行を除外） */
const BAD_INTRO_PATTERNS = [
  /^あなたは/,
  /攻略エキスパートとして/,
  /コア知識を(以下に|まとめ)/,
  /要約します/,
  /分析しました/,
  /として知られるキャラクター、(?!.*です)/,  // 別キャラ名を誤って言及
];

/** ダイジェストファイルからキャラ紹介文を抽出 */
function extractDigestIntro(digestPath: string): string | null {
  try {
    const content = fs.readFileSync(digestPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Markdown記法行はスキップ
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
      // AI前置き文はスキップ
      if (BAD_INTRO_PATTERNS.some((p) => p.test(trimmed))) continue;
      // 短すぎる行はスキップ（実質的な説明でない）
      if (trimmed.length < 30) continue;
      return trimmed.length > 150 ? trimmed.slice(0, 150) + "…" : trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/** ダイジェスト概要がないキャラ用のフォールバック紹介文を生成 */
function buildFallbackIntro(
  charName: string,
  topCategories: Array<{ category: string }>
): string {
  if (topCategories.length === 0) return `${charName}の攻略情報は準備中です。`;
  const catNames = topCategories
    .map(({ category }) => CATEGORY_LABELS[category] ?? category)
    .join("・");
  return `${charName}は${catNames}が注目されるキャラクターです。`;
}

interface KnowledgeHighlightData {
  topCategories: Array<{ category: string; count: number }>;
  totalEntries: number;
  sourceVideoCount: number;
  digestIntro: string | null;
  fallbackCategories: Array<{ category: string; count: number }>;
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

    const topCategories = getTopCategories(data.entries);

    return {
      topCategories,
      totalEntries: data.entries.length,
      sourceVideoCount: data.source_video_count ?? 0,
      digestIntro,
      // フォールバック用にカテゴリ情報を渡す
      fallbackCategories: topCategories,
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

  if (!data) return null;

  // ダイジェスト概要がなければ非表示
  if (!data.digestIntro) return null;
  const intro = data.digestIntro;

  return (
    <div className="mb-8 rounded-lg border border-blue-600/30 bg-blue-500/5 p-5">
      {/* ヘッダー */}
      <h2 className="text-base font-semibold text-theme-accent-blue mb-3">
        {charName} について
      </h2>

      {/* キャラ紹介文 */}
      <p className="mb-4 text-sm text-theme-muted leading-relaxed">
        {intro}
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
