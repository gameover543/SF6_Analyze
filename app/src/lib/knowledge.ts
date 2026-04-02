/**
 * ナレッジデータローダー v2
 *
 * 3層構造でナレッジを引き出す:
 *   1. ダイジェスト（コア知識）— 常にプロンプトに含める
 *   2. インデックス検索 — 質問からマッチアップ・カテゴリ・状況を特定して該当インデックスを読む
 *   3. キーワードマッチ（フォールバック）— インデックスで拾えなかった場合の補完
 */

import fs from "fs";
import path from "path";
import { CHAR_JP } from "@/lib/characters";

// --- 型定義 ---

interface KnowledgeEntry {
  id: string;
  category: string;
  topic: string;
  content: string;
  characters: string[];
  matchup: string | null;
  situation: string | null;
  source_video_id: string;
  source_channel: string;
  source_video_title: string;
  source_timestamp: string;
  source_quote: string;
  confidence: number;
  channel_trust: number;
  frame_data_conflicts: string[];
  extracted_at: string;
  // コーチング動画フィールド
  knowledge_type: "technique" | "coaching_pattern";
  target_rank: string;
  coaching_context: string;
  // パッチ鮮度管理
  game_version: string;
  video_upload_date: string;
  referenced_moves: string[];
  staleness_status: "current" | "possibly_stale" | "confirmed_stale";
  staleness_reason: string;
  last_validated_version: string;
}

interface CharacterKnowledge {
  slug: string;
  entries: KnowledgeEntry[];
  last_updated: string;
  source_video_count: number;
  last_validated_version: string;
}

// --- パス ---
// ローカル: ../data/ を参照、Vercel: ビルド前コピーされた data/ を参照
function resolveDataDir(subdir: string): string {
  const local = path.join(process.cwd(), "data", subdir);
  if (fs.existsSync(local)) return local;
  return path.join(process.cwd(), "..", "data", subdir);
}

const KNOWLEDGE_DIR = resolveDataDir("knowledge");
const STRUCTURED_DIR = path.join(KNOWLEDGE_DIR, "_structured");
const DIGESTS_DIR = path.join(KNOWLEDGE_DIR, "_digests");
const PATCHES_DIR = resolveDataDir("patches");

// --- 類義語辞書（検索拡張用） ---

const SYNONYMS: Record<string, string[]> = {
  // カテゴリの類義語
  "起き攻め": ["セットプレイ", "重ね", "ダウン後", "有利フレーム", "詐欺飛び", "安飛び", "起き上がり"],
  "立ち回り": ["差し合い", "間合い", "牽制", "置き技", "地上戦", "中距離", "距離管理"],
  "コンボ": ["繋がる", "レシピ", "火力", "ダメージ", "始動", "繋ぎ", "最大コンボ"],
  "対策": ["対面", "苦手", "きつい", "勝てない", "マッチアップ", "どうする", "対処"],
  "防御": ["守り", "切り返し", "暴れ", "パリィ", "ガード", "バーンアウト", "無敵", "割り込み"],
  "対空": ["飛び", "ジャンプ", "落とす", "昇竜", "AA"],
  "崩し": ["表裏", "投げ", "中段", "下段", "択"],
  // 状況の類義語
  "画面端": ["端", "壁", "コーナー"],
  "近距離": ["密着", "接近", "至近距離"],
  // システムの類義語
  "ドライブラッシュ": ["ラッシュ", "DR"],
  "ドライブインパクト": ["インパクト", "DI"],
  "確定反撃": ["確反", "確定"],
  "オーバードライブ": ["OD", "EX技", "EX"],
  "スーパーアーツ": ["SA", "超必", "クリティカルアーツ", "CA"],
  "投げ": ["コマ投げ", "スクリュー", "グラップ"],
  "中段": ["オーバーヘッド", "中段攻撃"],
  "ドライブゲージ": ["ゲージ管理", "ゲージ消費"],
};


// --- データローダー ---

function readJsonSafe(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readTextSafe(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * キャラのダイジェスト（コア知識要約）を読み込む
 */
function loadDigest(slug: string): string | null {
  return readTextSafe(path.join(DIGESTS_DIR, `${slug}.md`));
}

/**
 * マッチアップ別インデックスを読み込む
 * slug_vs_opponent が存在しない場合、opponent_vs_slug も試みる（逆方向ナレッジも活用）
 */
function loadMatchupIndex(slug: string, opponent: string): KnowledgeEntry[] {
  const forwardPath = path.join(STRUCTURED_DIR, "by_matchup", `${slug}_vs_${opponent}.json`);
  const forwardData = readJsonSafe(forwardPath);
  if (forwardData) return (forwardData as KnowledgeEntry[]);

  // 逆引き: opponent_vs_slug.json があればそれも活用
  const reversePath = path.join(STRUCTURED_DIR, "by_matchup", `${opponent}_vs_${slug}.json`);
  const reverseData = readJsonSafe(reversePath);
  return (reverseData as KnowledgeEntry[]) || [];
}

/**
 * カテゴリ別インデックスを読み込む
 */
function loadCategoryIndex(slug: string, category: string): KnowledgeEntry[] {
  const data = readJsonSafe(
    path.join(STRUCTURED_DIR, "by_category", `${slug}_${category}.json`)
  );
  return (data as KnowledgeEntry[]) || [];
}

/**
 * 状況別インデックスを読み込む
 */
function loadSituationIndex(situation: string): KnowledgeEntry[] {
  const data = readJsonSafe(
    path.join(STRUCTURED_DIR, "by_situation", `${situation}.json`)
  );
  return (data as KnowledgeEntry[]) || [];
}

function loadLatestPatchSummary(): string | null {
  try {
    const meta = readJsonSafe(path.join(PATCHES_DIR, "_meta.json")) as {
      patches: { diff_file: string }[];
    } | null;
    if (!meta?.patches?.length) return null;
    const latest = meta.patches[meta.patches.length - 1];
    const diff = readJsonSafe(path.join(PATCHES_DIR, latest.diff_file)) as {
      summary: string;
    } | null;
    return diff?.summary || null;
  } catch {
    return null;
  }
}

// --- トークン推定・予算管理 ---

/** テキストのおおよそのトークン数を推定（ASCII: 4文字=1トークン、日本語等: 1文字=1.5トークン） */
function estimateTokens(text: string): number {
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) ascii++;
    else nonAscii++;
  }
  return Math.ceil(ascii / 4 + nonAscii * 1.5);
}

// ダイジェストのトークン上限（約1200トークン ≈ 日本語約800文字）
const DIGEST_MAX_TOKENS = 1200;
// ナレッジコンテキスト全体のトークン予算
const KNOWLEDGE_TOKEN_BUDGET = 3500;
// 1エントリあたりの平均推定トークン数
const AVG_ENTRY_TOKENS = 150;

/**
 * ダイジェストをトークン上限内に切り詰める（行単位で丸める）
 * セクション（###見出し）の途中で切れることがあるが、
 * 前半の重要なコア情報は必ず含まれる
 */
function truncateDigest(digest: string, maxTokens: number): string {
  if (estimateTokens(digest) <= maxTokens) return digest;

  const lines = digest.split("\n");
  const result: string[] = [];
  let usedTokens = 0;

  for (const line of lines) {
    // 改行コスト（\n）を加算して推定
    const lineTokens = estimateTokens(line) + 0.25;
    if (usedTokens + lineTokens > maxTokens) {
      result.push("\n...（長いため省略）");
      break;
    }
    result.push(line);
    usedTokens += lineTokens;
  }

  return result.join("\n");
}

/**
 * トークン予算と質問の複雑さからナレッジエントリの最大件数を決定する
 * @param digestTokens ダイジェストが消費したトークン数
 * @param questionLength 最新質問の文字数
 * @returns エントリの最大件数（2〜8件）
 */
function calcMaxEntries(digestTokens: number, questionLength: number): number {
  // ダイジェスト消費後の残りトークン予算
  const remaining = KNOWLEDGE_TOKEN_BUDGET - Math.min(digestTokens, DIGEST_MAX_TOKENS);
  const tokenBudgetMax = Math.floor(remaining / AVG_ENTRY_TOKENS);

  // 質問の複雑さによる基準件数（長い質問ほど多くのコンテキストが有益）
  let baseEntries: number;
  if (questionLength < 30) {
    baseEntries = 3;  // 短い質問: 少なめで十分
  } else if (questionLength < 100) {
    baseEntries = 5;  // 中程度
  } else {
    baseEntries = 7;  // 長い/複雑な質問: 多めに注入
  }

  return Math.max(2, Math.min(8, Math.min(tokenBudgetMax, baseEntries)));
}

// --- クエリ分析 ---

/**
 * ユーザーの質問からマッチアップ対象キャラを検出
 * mainSlug（メインキャラ）を除いて最初にマッチしたキャラを返す
 * route.ts から通常モードでの対戦相手フレームデータ注入にも使用
 */
export function detectOpponent(text: string, mainSlug?: string): string | null {
  const lower = text.toLowerCase();
  for (const [slug, jp] of Object.entries(CHAR_JP)) {
    // メインキャラ自身はスキップ（「ジェイミーでケンに勝てない」でジェイミーを誤検出しない）
    if (slug === mainSlug) continue;
    if (lower.includes(jp.toLowerCase()) || lower.includes(slug)) {
      return slug;
    }
  }
  return null;
}

/**
 * ユーザーの質問からカテゴリを推定
 */
function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    matchup: ["対策", "対面", "苦手", "きつい", "勝てない", "マッチアップ"],
    combo: ["コンボ", "繋がる", "レシピ", "火力"],
    neutral: ["立ち回り", "差し合い", "間合い", "牽制", "地上戦"],
    oki: ["起き攻め", "セットプレイ", "重ね", "ダウン後", "安飛び"],
    defense: ["防御", "守り", "切り返し", "暴れ", "パリィ", "バーンアウト"],
  };
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

/**
 * ユーザーの質問から状況タグを検出
 */
function detectSituation(text: string): string | null {
  const lower = text.toLowerCase();
  const situationMap: Record<string, string[]> = {
    "画面端": ["画面端", "端", "壁"],
    "起き攻め": ["起き攻め", "セットプレイ", "重ね"],
    "対空": ["対空", "飛び", "ジャンプ"],
    "近距離": ["近距離", "密着", "接近"],
    "防御": ["防御", "守り", "切り返し", "バーンアウト"],
    "立ち回り": ["立ち回り", "中距離"],
  };
  for (const [tag, keywords] of Object.entries(situationMap)) {
    if (keywords.some((kw) => lower.includes(kw))) return tag;
  }
  return null;
}

/**
 * 検索クエリを類義語で拡張
 */
function expandQuery(text: string): string {
  let expanded = text;
  for (const [term, synonyms] of Object.entries(SYNONYMS)) {
    if (text.includes(term)) {
      expanded += " " + synonyms.join(" ");
    }
    // 逆方向: 類義語がテキストに含まれていたら元の用語も追加
    for (const syn of synonyms) {
      if (text.includes(syn) && !expanded.includes(term)) {
        expanded += " " + term;
      }
    }
  }
  return expanded;
}

// --- スコアリング ---

/**
 * ナレッジエントリとクエリの関連スコアを計算する
 * @param entry スコアリング対象のエントリ
 * @param expandedQuery 類義語拡張済みのクエリ文字列
 * @param detectedCategory クエリから検出したカテゴリ（マッチ時に+4ボーナス）
 */
function scoreEntry(
  entry: KnowledgeEntry,
  expandedQuery: string,
  detectedCategory?: string | null
): number {
  let score = 0;
  const q = expandedQuery.toLowerCase();

  // カテゴリ直接一致ボーナス（質問の意図と合致するエントリを優先）
  if (detectedCategory && entry.category === detectedCategory) score += 4;

  // トピック一致
  const topicWords = entry.topic.split(/[\s、。]+/).filter((w) => w.length >= 2);
  for (const w of topicWords) {
    if (q.includes(w.toLowerCase())) score += 3;
  }

  // content内のキーワード一致（200文字・15ワードに拡張）
  const contentWords = entry.content.substring(0, 200).split(/[\s、。]+/).filter((w) => w.length >= 3);
  for (const w of contentWords.slice(0, 15)) {
    if (q.includes(w.toLowerCase())) score += 1;
  }

  // マッチアップ一致
  if (entry.matchup && q.includes(entry.matchup)) score += 5;

  // 状況一致
  if (entry.situation) {
    for (const s of entry.situation.split("、")) {
      if (q.includes(s.trim().toLowerCase())) score += 3;
    }
  }

  // 信頼度・鮮度
  score *= entry.confidence;
  score *= 0.5 + entry.channel_trust * 0.5;
  if (entry.staleness_status === "confirmed_stale") score *= 0.3;
  else if (entry.staleness_status === "possibly_stale") score *= 0.6;

  return score;
}

// --- メインAPI ---

/**
 * コーチのプロンプトに注入するナレッジコンテキストを生成
 *
 * 3層構造:
 *   1. ダイジェスト — メインキャラのコア知識（常に含める、~1500文字）
 *   2. インデックス検索 — 質問に応じたピンポイント検索（~5件）
 *   3. キーワードフォールバック — 拾えなかった場合の補完（~5件）
 */
export function buildKnowledgeContext(
  characterSlugs: string[],
  recentMessages: string[] = []
): string {
  const lines: string[] = [];
  const mainSlug = characterSlugs[0];

  // === 層1: ダイジェスト（コア知識） ===
  let digestTokens = 0;
  if (mainSlug) {
    const digest = loadDigest(mainSlug);
    if (digest) {
      // トークン上限を超える場合は行単位で切り詰め
      const truncated = truncateDigest(digest, DIGEST_MAX_TOKENS);
      digestTokens = estimateTokens(truncated);
      const charName = CHAR_JP[mainSlug] || mainSlug;
      lines.push(`## ${charName} のコア知識\n`);
      lines.push(truncated);
      lines.push("");
    }
  }

  // === 層2: インデックス検索（質問に応じたピンポイント） ===
  const latestQuestion = recentMessages.length > 0
    ? recentMessages[recentMessages.length - 1]
    : "";

  // ダイジェスト消費後のトークン残量と質問の複雑さからエントリ上限を決定
  const maxEntries = calcMaxEntries(digestTokens, latestQuestion.length);

  // スコアリングで使うカテゴリを事前検出（層3フォールバックでも使用）
  const detectedCategory = latestQuestion ? detectCategory(latestQuestion) : null;

  let indexEntries: KnowledgeEntry[] = [];

  if (latestQuestion) {
    // マッチアップ検出（メインキャラ自身は除外して対戦相手を検索）
    const opponent = detectOpponent(latestQuestion, mainSlug);
    if (opponent && mainSlug) {
      const matchupEntries = loadMatchupIndex(mainSlug, opponent);
      indexEntries.push(...matchupEntries);
    }

    // カテゴリ検出
    if (detectedCategory && mainSlug) {
      const catEntries = loadCategoryIndex(mainSlug, detectedCategory);
      indexEntries.push(...catEntries);
    }

    // 状況検出
    const situation = detectSituation(latestQuestion);
    if (situation) {
      const sitEntries = loadSituationIndex(situation);
      // メインキャラに関連するもののみ
      const filtered = mainSlug
        ? sitEntries.filter((e) => e.characters.includes(mainSlug))
        : sitEntries;
      indexEntries.push(...filtered);
    }
  }

  // 重複排除
  const seenIds = new Set<string>();
  indexEntries = indexEntries.filter((e) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });

  // スコアリングして上位 maxEntries 件（動的件数）
  const expandedQuery = latestQuestion ? expandQuery(latestQuestion) : "";
  if (indexEntries.length > 0 && expandedQuery) {
    indexEntries = indexEntries
      .map((e) => ({ entry: e, score: scoreEntry(e, expandedQuery, detectedCategory) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxEntries)
      .map((s) => s.entry);
  } else {
    indexEntries = indexEntries.slice(0, maxEntries);
  }

  // === 層3: キーワードフォールバック ===
  // インデックスで maxEntries 件未満の場合、全エントリからキーワード検索で補完
  let fallbackEntries: KnowledgeEntry[] = [];
  if (indexEntries.length < maxEntries && expandedQuery) {
    const needed = maxEntries - indexEntries.length;
    const allEntries: KnowledgeEntry[] = [];
    for (const slug of characterSlugs) {
      const data = readJsonSafe(path.join(KNOWLEDGE_DIR, `${slug}.json`)) as CharacterKnowledge | null;
      if (data?.entries) allEntries.push(...data.entries);
    }
    // 一般知識も追加
    const general = readJsonSafe(path.join(KNOWLEDGE_DIR, "general.json")) as CharacterKnowledge | null;
    if (general?.entries) allEntries.push(...general.entries);

    fallbackEntries = allEntries
      .filter((e) => !seenIds.has(e.id))
      .map((e) => ({ entry: e, score: scoreEntry(e, expandedQuery, detectedCategory) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, needed)
      .map((s) => s.entry);
  }

  const selectedEntries = [...indexEntries, ...fallbackEntries];

  // 攻略知識とコーチングパターンを分離
  const techniqueEntries = selectedEntries.filter(
    (e) => (e as KnowledgeEntry & { knowledge_type?: string }).knowledge_type !== "coaching_pattern"
  );
  const coachingEntries = selectedEntries.filter(
    (e) => (e as KnowledgeEntry & { knowledge_type?: string }).knowledge_type === "coaching_pattern"
  );

  // === 出力フォーマット ===
  if (techniqueEntries.length > 0) {
    lines.push(`## 質問に関連する知識（${techniqueEntries.length}件）\n`);

    // パッチサマリー
    const patchSummary = loadLatestPatchSummary();
    if (patchSummary) {
      lines.push(`### 最新パッチ変更点`);
      lines.push(patchSummary);
      lines.push(`（⚠マーク付き知識はこの変更に関連。フレームデータを優先すること）`);
      lines.push("");
    }

    for (const entry of techniqueEntries) {
      let stalenessMark = "";
      if (entry.staleness_status === "confirmed_stale") {
        stalenessMark = " **[旧バージョン情報]**";
      } else if (entry.staleness_status === "possibly_stale") {
        stalenessMark = entry.staleness_reason
          ? ` ⚠[パッチで変更の可能性: ${entry.staleness_reason}]`
          : " ⚠[パッチで変更の可能性]";
      }

      const conflictMark =
        entry.frame_data_conflicts?.length > 0
          ? ` ⚠フレームデータと矛盾: ${entry.frame_data_conflicts[0]}`
          : "";

      lines.push(
        `- **[${entry.category}] ${entry.topic}**${stalenessMark}${conflictMark}`
      );
      lines.push(`  ${entry.content}`);
      lines.push("");
    }
  }

  // === コーチングパターン ===
  if (coachingEntries.length > 0) {
    lines.push(`## プロのコーチングパターン（${coachingEntries.length}件）\n`);
    lines.push(`以下はプロ選手が実際にコーチングした時の課題診断と対処法です。回答スタイルの参考にしてください。\n`);
    for (const entry of coachingEntries) {
      const rank = (entry as KnowledgeEntry & { target_rank?: string }).target_rank;
      const rankMark = rank ? ` [${rank}帯向け]` : "";
      lines.push(`- **${entry.topic}**${rankMark}`);
      lines.push(`  ${entry.content}`);
      lines.push("");
    }
  }

  // 引用ルール
  if (lines.length > 0) {
    lines.push(`### 知識の使い方`);
    lines.push(
      `- 上記知識をアドバイスに自然に組み込むこと。情報ソース（チャンネル名・動画名）はユーザーに表示しないこと`
    );
    lines.push(
      `- ⚠マーク・[旧バージョン情報]付きの知識は数値を信用せず「パッチで変更された可能性がある」と留保をつけること`
    );
    lines.push(
      `- フレームデータと矛盾する知識はフレームデータを優先すること`
    );
    lines.push(
      `- 戦略的アドバイス（画面端では攻めを継続、等）はパッチ後も有効な場合が多い`
    );
  }

  return lines.join("\n");
}

/**
 * マッチアップ特化コーチング用のナレッジコンテキストを生成
 *
 * 通常のbuildKnowledgeContextと異なり、マッチアップデータを全件優先的に含め、
 * 質問に応じてカテゴリナレッジを補完する構造にする。
 */
export function buildMatchupKnowledgeContext(
  mainSlug: string,
  opponentSlug: string,
  recentMessages: string[] = []
): string {
  const lines: string[] = [];
  const mainName = CHAR_JP[mainSlug] || mainSlug;
  const opponentName = CHAR_JP[opponentSlug] || opponentSlug;

  // 質問はマッチアップ上限計算にも使うため先に取得
  const latestQuestion =
    recentMessages.length > 0
      ? recentMessages[recentMessages.length - 1]
      : "";

  // === マッチアップデータ（トークン予算内で上限付き） ===
  // マッチアップは最も関連性が高いため通常より多め（+3件）、最大12件
  const allMatchupEntries = loadMatchupIndex(mainSlug, opponentSlug);
  const maxMatchupEntries = Math.min(
    allMatchupEntries.length,
    Math.min(12, calcMaxEntries(0, latestQuestion.length) + 3)
  );
  const matchupEntries = allMatchupEntries.slice(0, maxMatchupEntries);
  const seenIds = new Set<string>(matchupEntries.map((e) => e.id));

  if (matchupEntries.length > 0) {
    lines.push(
      `## ${mainName} vs ${opponentName} マッチアップナレッジ（${matchupEntries.length}件）\n`
    );

    const patchSummary = loadLatestPatchSummary();
    if (patchSummary) {
      lines.push(`### 最新パッチ変更点`);
      lines.push(patchSummary);
      lines.push(
        `（⚠マーク付き知識はこの変更に関連。フレームデータを優先すること）`
      );
      lines.push("");
    }

    for (const entry of matchupEntries) {
      let stalenessMark = "";
      if (entry.staleness_status === "confirmed_stale") {
        stalenessMark = " **[旧バージョン情報]**";
      } else if (entry.staleness_status === "possibly_stale") {
        stalenessMark = entry.staleness_reason
          ? ` ⚠[パッチで変更の可能性: ${entry.staleness_reason}]`
          : " ⚠[パッチで変更の可能性]";
      }
      lines.push(`- **[${entry.category}] ${entry.topic}**${stalenessMark}`);
      lines.push(`  ${entry.content}`);
      lines.push("");
    }
  } else {
    lines.push(
      `## ${mainName} vs ${opponentName} マッチアップナレッジ\n`
    );
    lines.push(
      `（このマッチアップの専用ナレッジはまだ収録されていません）\n`
    );
  }

  // === 質問に応じた補完ナレッジ（カテゴリ + キーワードフォールバック） ===
  if (latestQuestion) {
    const expandedQuery = expandQuery(latestQuestion);

    // カテゴリ別ナレッジ補完
    const category = detectCategory(latestQuestion);
    if (category) {
      const catEntries = loadCategoryIndex(mainSlug, category).filter(
        (e) => !seenIds.has(e.id)
      );
      const scored = catEntries
        .map((e) => ({ entry: e, score: scoreEntry(e, expandedQuery, category) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.entry);

      if (scored.length > 0) {
        lines.push(`## ${mainName} の関連ナレッジ（${scored.length}件）\n`);
        for (const entry of scored) {
          lines.push(`- **[${entry.category}] ${entry.topic}**`);
          lines.push(`  ${entry.content}`);
          lines.push("");
          seenIds.add(entry.id);
        }
      }
    }

    // キーワードフォールバック（合計 maxMatchupEntries 件未満の場合）
    const totalSoFar = matchupEntries.length + (seenIds.size - matchupEntries.length);
    if (totalSoFar < maxMatchupEntries) {
      const needed = maxMatchupEntries - totalSoFar;
      const allEntries: KnowledgeEntry[] = [];
      const data = readJsonSafe(
        path.join(KNOWLEDGE_DIR, `${mainSlug}.json`)
      ) as { entries: KnowledgeEntry[] } | null;
      if (data?.entries) allEntries.push(...data.entries);

      const matchupDetectedCategory = detectCategory(latestQuestion);
      const fallback = allEntries
        .filter((e) => !seenIds.has(e.id))
        .map((e) => ({ entry: e, score: scoreEntry(e, expandedQuery, matchupDetectedCategory) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, needed)
        .map((s) => s.entry);

      if (fallback.length > 0) {
        lines.push(
          `## ${mainName} の追加ナレッジ（${fallback.length}件）\n`
        );
        for (const entry of fallback) {
          lines.push(`- **[${entry.category}] ${entry.topic}**`);
          lines.push(`  ${entry.content}`);
          lines.push("");
        }
      }
    }
  }

  if (lines.length > 0) {
    lines.push(`### 知識の使い方`);
    lines.push(
      `- このマッチアップに特化した視点でアドバイスすること`
    );
    lines.push(
      `- ⚠マーク・[旧バージョン情報]付きの知識は数値を信用せず「パッチで変更された可能性がある」と留保をつけること`
    );
    lines.push(
      `- フレームデータと矛盾する知識はフレームデータを優先すること`
    );
    lines.push(
      `- 情報ソース（チャンネル名・動画名）はユーザーに表示しないこと`
    );
  }

  return lines.join("\n");
}
