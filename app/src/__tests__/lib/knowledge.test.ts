/**
 * knowledge.ts のユニットテスト
 *
 * fs モジュールをモックしてファイルシステム依存を除去し、
 * buildKnowledgeContext / buildMatchupKnowledgeContext の
 * 出力フォーマットと条件分岐を検証する。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- fs モック ---
// knowledge.ts が import fs from "fs" を呼ぶ前にモックを設定する必要がある。
// vi.mock はファイル先頭に巻き上げられるため、ここに記述すれば OK。

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import fs from "fs";
import { buildKnowledgeContext, buildMatchupKnowledgeContext } from "@/lib/knowledge";

// テスト用ナレッジエントリのファクトリ
const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry-001",
  category: "combo",
  topic: "基本コンボ",
  content: "5LP > 5MK > 236LP が基本コンボ",
  characters: ["jamie"],
  matchup: null,
  situation: null,
  source_video_id: "abc123",
  source_channel: "テストch",
  source_video_title: "テスト動画",
  source_timestamp: "1:23",
  source_quote: "",
  confidence: 1.0,
  channel_trust: 1.0,
  frame_data_conflicts: [],
  extracted_at: "2024-01-01",
  knowledge_type: "technique",
  target_rank: "マスター",
  coaching_context: "",
  game_version: "1.0",
  video_upload_date: "2024-01-01",
  referenced_moves: [],
  staleness_status: "current",
  staleness_reason: "",
  last_validated_version: "1.0",
  ...overrides,
});

// fs モックのリセットと基本設定
beforeEach(() => {
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readFileSync).mockReturnValue("");
});

// --- buildKnowledgeContext ---

describe("buildKnowledgeContext", () => {
  it("データが何もない場合は空文字を返す", () => {
    const result = buildKnowledgeContext(["jamie"], []);
    expect(result).toBe("");
  });

  it("ダイジェストファイルがある場合はコア知識セクションを含む", () => {
    // jamie.md が存在する設定
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("jamie.md")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith("jamie.md")) return "ジェイミーはレベルアップで強化される";
      return "";
    });

    const result = buildKnowledgeContext(["jamie"], []);
    expect(result).toContain("ジェイミー のコア知識");
    expect(result).toContain("ジェイミーはレベルアップで強化される");
  });

  it("カテゴリインデックスにヒットした場合は関連知識セクションを含む", () => {
    const entry = makeEntry({ topic: "起き攻めセットプレイ", category: "oki" });

    // by_category/jamie_oki.json が存在する設定
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("jamie_oki.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("jamie_oki.json"))
        return JSON.stringify([entry]);
      return "";
    });

    // "起き攻め" キーワードを含む質問を渡す
    const result = buildKnowledgeContext(["jamie"], ["ジェイミーの起き攻めを教えて"]);
    expect(result).toContain("質問に関連する知識");
    expect(result).toContain("起き攻めセットプレイ");
  });

  it("staleness_status が confirmed_stale のエントリには [旧バージョン情報] が付く", () => {
    const staleEntry = makeEntry({
      staleness_status: "confirmed_stale",
      topic: "古いコンボ",
      category: "combo",
    });

    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("jamie_combo.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("jamie_combo.json"))
        return JSON.stringify([staleEntry]);
      return "";
    });

    const result = buildKnowledgeContext(["jamie"], ["ジェイミーのコンボを教えて"]);
    expect(result).toContain("[旧バージョン情報]");
  });

  it("knowledge_type が coaching_pattern のエントリはコーチングパターンセクションに入る", () => {
    const coachEntry = makeEntry({
      knowledge_type: "coaching_pattern",
      topic: "暴れ癖の改善",
      category: "defense",
    });

    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("jamie_defense.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("jamie_defense.json"))
        return JSON.stringify([coachEntry]);
      return "";
    });

    const result = buildKnowledgeContext(["jamie"], ["防御方法を教えて"]);
    expect(result).toContain("プロのコーチングパターン");
    expect(result).toContain("暴れ癖の改善");
  });
});

// --- buildMatchupKnowledgeContext ---

describe("buildMatchupKnowledgeContext", () => {
  it("マッチアップデータなしの場合は「専用ナレッジなし」メッセージを含む", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = buildMatchupKnowledgeContext("jamie", "ken", []);
    expect(result).toContain("ジェイミー vs ケン マッチアップナレッジ");
    expect(result).toContain("専用ナレッジはまだ収録されていません");
  });

  it("マッチアップファイルが存在する場合は全件を含む", () => {
    const e1 = makeEntry({ id: "mu-001", topic: "ケン対策1" });
    const e2 = makeEntry({ id: "mu-002", topic: "ケン対策2" });

    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("jamie_vs_ken.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("jamie_vs_ken.json"))
        return JSON.stringify([e1, e2]);
      return "";
    });

    const result = buildMatchupKnowledgeContext("jamie", "ken", []);
    expect(result).toContain("ジェイミー vs ケン マッチアップナレッジ（2件）");
    expect(result).toContain("ケン対策1");
    expect(result).toContain("ケン対策2");
  });

  it("順方向ファイルなし・逆引きファイルありの場合もナレッジを取得できる", () => {
    const e1 = makeEntry({ id: "rev-001", topic: "ケン側からのジェイミー対策" });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      // 正方向は存在しない、逆引きのみ存在
      if (String(p).includes("jamie_vs_ken.json")) return false;
      if (String(p).includes("ken_vs_jamie.json")) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("ken_vs_jamie.json"))
        return JSON.stringify([e1]);
      return "";
    });

    const result = buildMatchupKnowledgeContext("jamie", "ken", []);
    expect(result).toContain("ジェイミー vs ケン マッチアップナレッジ（1件）");
    expect(result).toContain("ケン側からのジェイミー対策");
  });
});
