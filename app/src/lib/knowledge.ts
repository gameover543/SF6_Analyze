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
}

interface CharacterKnowledge {
  slug: string;
  entries: KnowledgeEntry[];
  last_updated: string;
  source_video_count: number;
}

// ナレッジディレクトリのパス（プロジェクトルートの data/knowledge/）
const KNOWLEDGE_DIR = path.join(process.cwd(), "..", "data", "knowledge");

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

  for (const entry of selected) {
    const source = `${entry.source_channel}（${entry.source_timestamp}）`;
    const trustMark = entry.confidence < 0.5 ? " ⚠未検証" : "";
    const conflictMark =
      entry.frame_data_conflicts.length > 0
        ? ` ⚠フレームデータと矛盾あり: ${entry.frame_data_conflicts[0]}`
        : "";

    lines.push(
      `- **[${entry.category}] ${entry.topic}**${trustMark}${conflictMark}`
    );
    lines.push(`  ${entry.content}`);
    lines.push(`  ─ ${source}`);
    lines.push("");
  }

  lines.push(`### 引用ルール`);
  lines.push(
    `- 上記知識を引用する際は「〇〇選手によると」のようにソースを示すこと`
  );
  lines.push(
    `- ⚠マーク付きの知識は「〜という意見もある」と留保をつけること`
  );
  lines.push(
    `- フレームデータと矛盾する知識はフレームデータを優先すること`
  );

  return lines.join("\n");
}
