/**
 * ナレッジデータローダー
 * data/knowledge/{slug}.json からプロ選手の攻略知識を読み込み、
 * 会話トピックに関連する知識をプロンプトに注入する
 */

import fs from "fs";
import path from "path";

// ナレッジエントリの型定義
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

// ナレッジディレクトリのパス（プロジェクトルートの data/knowledge/）
const KNOWLEDGE_DIR = path.join(process.cwd(), "..", "data", "knowledge");
const PATCHES_DIR = path.join(process.cwd(), "..", "data", "patches");

/**
 * キャラクターのナレッジデータを読み込む
 */
function loadCharacterKnowledge(slug: string): CharacterKnowledge | null {
  const filePath = path.join(KNOWLEDGE_DIR, `${slug}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return data as CharacterKnowledge;
  } catch {
    return null;
  }
}

/**
 * 最新のパッチ変更サマリーを読み込む
 */
function loadLatestPatchSummary(): string | null {
  try {
    const metaPath = path.join(PATCHES_DIR, "_meta.json");
    if (!fs.existsSync(metaPath)) return null;

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    const patches = meta.patches || [];
    if (patches.length === 0) return null;

    // 最新のdiffファイルを読む
    const latest = patches[patches.length - 1];
    const diffPath = path.join(PATCHES_DIR, latest.diff_file);
    if (!fs.existsSync(diffPath)) return null;

    const diff = JSON.parse(fs.readFileSync(diffPath, "utf-8"));
    return diff.summary || null;
  } catch {
    return null;
  }
}

/**
 * 会話の最近のメッセージからキーワードを抽出し、
 * 関連するナレッジエントリを選別する
 */
function filterRelevantEntries(
  entries: KnowledgeEntry[],
  recentMessages: string[],
  maxEntries: number = 10
): KnowledgeEntry[] {
  // 最近のメッセージからキーワードを収集
  const messageText = recentMessages.join(" ").toLowerCase();

  // 各エントリにスコアを付与
  const scored = entries.map((entry) => {
    let score = 0;

    // トピック・内容がメッセージのキーワードに一致するか
    const entryText = `${entry.topic} ${entry.content} ${entry.situation || ""}`.toLowerCase();

    // カテゴリ別の関連キーワード
    const categoryKeywords: Record<string, string[]> = {
      matchup: ["対策", "対面", "苦手", "きつい", "勝てない", "どうすれば"],
      combo: ["コンボ", "繋がる", "レシピ", "火力", "ダメージ"],
      neutral: ["立ち回り", "差し合い", "間合い", "置き", "差し返し", "牽制"],
      oki: ["起き攻め", "セットプレイ", "ダウン", "重ね"],
      defense: ["防御", "守り", "切り返し", "暴れ", "バーンアウト", "パリィ"],
      general: [],
    };

    // メッセージ内のキーワードとの一致度
    const keywords = categoryKeywords[entry.category] || [];
    for (const kw of keywords) {
      if (messageText.includes(kw)) score += 3;
    }

    // キャラ名・マッチアップの一致
    if (entry.matchup && messageText.includes(entry.matchup)) score += 5;

    // 状況の一致
    if (entry.situation) {
      const situations = entry.situation.split("、");
      for (const s of situations) {
        if (messageText.includes(s.toLowerCase())) score += 3;
      }
    }

    // トピック内の単語一致
    const topicWords = entry.topic.split(/[\s、。]+/).filter((w) => w.length >= 2);
    for (const w of topicWords) {
      if (messageText.includes(w.toLowerCase())) score += 2;
    }

    // 信頼度による重み付け
    score *= entry.confidence;
    // チャンネル信頼度による重み付け
    score *= 0.5 + entry.channel_trust * 0.5;

    // 鮮度ペナルティ
    if (entry.staleness_status === "confirmed_stale") score *= 0.3;
    else if (entry.staleness_status === "possibly_stale") score *= 0.6;

    return { entry, score };
  });

  // スコア順にソートして上位を返す
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxEntries)
    .map((s) => s.entry);
}

/**
 * コーチのプロンプトに注入するナレッジコンテキストを生成
 */
export function buildKnowledgeContext(
  characterSlugs: string[],
  recentMessages: string[] = []
): string {
  // 関連キャラのナレッジを全部読み込む
  const allEntries: KnowledgeEntry[] = [];
  const loadedChars: string[] = [];

  for (const slug of characterSlugs) {
    const knowledge = loadCharacterKnowledge(slug);
    if (knowledge && knowledge.entries.length > 0) {
      allEntries.push(...knowledge.entries);
      loadedChars.push(slug);
    }
  }

  if (allEntries.length === 0) {
    return ""; // ナレッジなし
  }

  // メッセージがある場合はキーワード一致でフィルタ、なければ全体から上位を選択
  let selected: KnowledgeEntry[];
  if (recentMessages.length > 0) {
    selected = filterRelevantEntries(allEntries, recentMessages, 10);
    // スコア0件の場合は信頼度順で上位を補完
    if (selected.length < 3) {
      const fallback = allEntries
        .filter((e) => !selected.includes(e))
        .sort((a, b) => b.confidence * b.channel_trust - a.confidence * a.channel_trust)
        .slice(0, 5);
      selected = [...selected, ...fallback].slice(0, 10);
    }
  } else {
    selected = allEntries
      .sort((a, b) => b.confidence * b.channel_trust - a.confidence * a.channel_trust)
      .slice(0, 10);
  }

  if (selected.length === 0) {
    return "";
  }

  // プロンプト用テキストに整形
  const lines: string[] = [
    `## プロ選手の知識（動画から抽出・検証済み / ${selected.length}件）\n`,
  ];

  // パッチサマリーがあれば先頭に注入
  const patchSummary = loadLatestPatchSummary();
  if (patchSummary) {
    lines.push(`### 最新パッチ変更点`);
    lines.push(patchSummary);
    lines.push(`（⚠マーク付き知識はこの変更に関連。フレームデータを優先すること）`);
    lines.push("");
  }

  for (const entry of selected) {
    // 鮮度マーク
    let stalenessMark = "";
    if (entry.staleness_status === "confirmed_stale") {
      stalenessMark = " **[旧バージョン情報]**";
    } else if (entry.staleness_status === "possibly_stale") {
      stalenessMark = entry.staleness_reason
        ? ` ⚠[パッチで変更の可能性: ${entry.staleness_reason}]`
        : " ⚠[パッチで変更の可能性]";
    }

    const conflictMark =
      entry.frame_data_conflicts.length > 0
        ? ` ⚠フレームデータと矛盾: ${entry.frame_data_conflicts[0]}`
        : "";

    lines.push(
      `- **[${entry.category}] ${entry.topic}**${stalenessMark}${conflictMark}`
    );
    lines.push(`  ${entry.content}`);
    lines.push("");
  }

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

  return lines.join("\n");
}
