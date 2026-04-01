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

// --- ナレッジ検索精度評価テストセット ---
//
// 典型的な質問パターンに対して「期待される関連エントリが結果に含まれるか（再現率）」と
// 「無関係なエントリが含まれないか（適合率）」を検証する。
//
// テストケース構成:
//   - related: 質問と関連するエントリ（結果に含まれることを期待）
//   - unrelated: 質問と無関係なエントリ（結果に含まれないことを期待）

describe("ナレッジ検索精度評価テストセット", () => {
  // === テスト1: 起き攻めクエリ ===
  it("[起き攻め] 再現率: 関連エントリ3件が全て結果に含まれる", () => {
    const r1 = makeEntry({ id: "oki-r1", category: "oki", topic: "起き攻め 重ね セットプレイ", situation: "起き攻め" });
    const r2 = makeEntry({ id: "oki-r2", category: "oki", topic: "ダウン後 詐欺飛び 安飛び" });
    const r3 = makeEntry({ id: "oki-r3", category: "oki", topic: "重ね タイミング 調整" });
    // カテゴリインデックス（by_category/jamie_oki.json）に3件
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("by_category/jamie_oki.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("by_category/jamie_oki.json")) return JSON.stringify([r1, r2, r3]);
      return "";
    });
    const result = buildKnowledgeContext(["jamie"], ["ジェイミーの起き攻め方法を教えてください"]);
    // 再現率チェック: 関連エントリが全て含まれる
    expect(result).toContain("起き攻め 重ね セットプレイ");
    expect(result).toContain("ダウン後 詐欺飛び 安飛び");
    expect(result).toContain("重ね タイミング 調整");
  });

  it("[起き攻め] 適合率: 非関連エントリ（コンボ）は含まれない", () => {
    // 関連エントリ（起き攻め）でインデックスを埋める
    const r1 = makeEntry({ id: "oki-r1", category: "oki", topic: "起き攻め 重ね セットプレイ" });
    const r2 = makeEntry({ id: "oki-r2", category: "oki", topic: "詐欺飛び 安飛び 起き攻め" });
    const r3 = makeEntry({ id: "oki-r3", category: "oki", topic: "ダウン後 有利フレーム 活用" });
    // 非関連エントリ（コンボ）— フォールバックデータに混在
    const irr1 = makeEntry({ id: "combo-irr1", category: "combo", topic: "基本コンボ レシピ" });
    const irr2 = makeEntry({ id: "combo-irr2", category: "combo", topic: "高火力 始動技 コンボ" });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return s.includes("by_category/jamie_oki.json") ||
             (s.endsWith("jamie.json") && !s.includes("_structured") && !s.includes("_digests"));
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const s = String(p);
      if (s.includes("by_category/jamie_oki.json")) return JSON.stringify([r1, r2, r3]);
      if (s.endsWith("jamie.json") && !s.includes("_structured") && !s.includes("_digests"))
        return JSON.stringify({ entries: [r1, r2, r3, irr1, irr2] });
      return "";
    });
    const result = buildKnowledgeContext(["jamie"], ["ジェイミーの起き攻め方法を教えてください"]);
    // 適合率チェック: 関連エントリ3件でmaxEntries埋まるため非関連は含まれない
    expect(result).not.toContain("基本コンボ レシピ");
    expect(result).not.toContain("高火力 始動技 コンボ");
  });

  // === テスト2: コンボクエリ ===
  it("[コンボ] カテゴリボーナス: インデックスなし時もカテゴリ一致エントリが優先される", () => {
    // カテゴリ "combo" のエントリ（カテゴリ直接一致ボーナス +4）
    const comboEntry = makeEntry({
      id: "combo-c1",
      category: "combo",
      // トピックにコンボ系キーワードがなくても、カテゴリボーナスで上位に来ることを確認
      topic: "入力 練習 方法",
    });
    // カテゴリ "oki" のエントリ（コンボ系キーワードを含む → ボーナスなしでのトピックスコア高め）
    const okiEntry = makeEntry({
      id: "oki-o1",
      category: "oki",
      topic: "コンボ 後 起き攻め 択", // "コンボ" を含む → トピックマッチ +3
    });

    // カテゴリインデックスなし。フォールバックのみ
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("jamie.json") && !String(p).includes("_structured") && !String(p).includes("_digests")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith("jamie.json") && !String(p).includes("_structured") && !String(p).includes("_digests"))
        return JSON.stringify({ entries: [comboEntry, okiEntry] });
      return "";
    });

    const result = buildKnowledgeContext(["jamie"], ["コンボのレシピを教えてください"]);
    // カテゴリボーナス (+4) により combo エントリが oki エントリより先に来る
    // （oki エントリもスコアがあれば含まれるが、combo エントリが必ず含まれる）
    expect(result).toContain("入力 練習 方法");
  });

  // === テスト3: 対策クエリ（マッチアップ検出） ===
  it("[対策] マッチアップキーワードでケン対策エントリが取得できる", () => {
    const matchupEntry = makeEntry({
      id: "mu-k1",
      category: "matchup",
      topic: "ケン 対策 立ち回り",
      matchup: "ケン",
    });
    // カテゴリインデックス（matchup）
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("by_category/jamie_matchup.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("by_category/jamie_matchup.json")) return JSON.stringify([matchupEntry]);
      return "";
    });
    const result = buildKnowledgeContext(["jamie"], ["ケンが苦手なんですが対策を教えてください"]);
    expect(result).toContain("ケン 対策 立ち回り");
  });

  // === テスト4: 類義語拡張テスト ===
  it("[類義語] 「差し合い」→ 立ち回りカテゴリのエントリを取得できる", () => {
    const neutralEntry = makeEntry({
      id: "neu-n1",
      category: "neutral",
      topic: "立ち回り 中距離 牽制",
    });
    // "差し合い" が "立ち回り" の類義語として展開される → neutral カテゴリ検出
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("by_category/jamie_neutral.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("by_category/jamie_neutral.json")) return JSON.stringify([neutralEntry]);
      return "";
    });
    // "差し合い" は直接 detectCategory では "neutral" を返さないが
    // カテゴリキーワードに "差し合い" が含まれているため neutral が検出される
    const result = buildKnowledgeContext(["jamie"], ["差し合いでどう戦えばいいですか"]);
    expect(result).toContain("立ち回り 中距離 牽制");
  });

  // === テスト5: 防御クエリ ===
  it("[防御] バーンアウト時の守り方クエリで防御エントリが取得できる", () => {
    const defEntry = makeEntry({
      id: "def-d1",
      category: "defense",
      topic: "バーンアウト 守り 切り返し",
    });
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).includes("by_category/jamie_defense.json")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).includes("by_category/jamie_defense.json")) return JSON.stringify([defEntry]);
      return "";
    });
    const result = buildKnowledgeContext(["jamie"], ["バーンアウトしてしまったときの守り方を教えてください"]);
    expect(result).toContain("バーンアウト 守り 切り返し");
  });

  // === テスト6: OD類義語拡張テスト（新規SYNONYMS検証） ===
  it("[類義語] 「OD」→ オーバードライブエントリが取得できる", () => {
    const odEntry = makeEntry({
      id: "od-o1",
      category: "combo",
      topic: "オーバードライブ 活用 コンボ始動",
    });
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("jamie.json") && !String(p).includes("_structured") && !String(p).includes("_digests")
    );
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith("jamie.json") && !String(p).includes("_structured") && !String(p).includes("_digests"))
        return JSON.stringify({ entries: [odEntry] });
      return "";
    });
    // "OD" は "オーバードライブ" の類義語として展開され、"オーバードライブ" トピックにマッチする
    const result = buildKnowledgeContext(["jamie"], ["ODを使ったコンボを教えてください"]);
    expect(result).toContain("オーバードライブ 活用 コンボ始動");
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
