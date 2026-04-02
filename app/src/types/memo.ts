/** 対戦メモ1件 */
export interface Memo {
  /** UUID */
  id: string;
  /** 対戦相手キャラのslug */
  opponentSlug: string;
  /** メモ本文（最大300文字） */
  body: string;
  /** プリセットタグ（複数選択可） */
  tags: MemoTag[];
  /** 勝敗（任意） */
  result?: "win" | "lose";
  /** 作成日時 ISO8601 */
  createdAt: string;
}

/** プリセットタグ */
export type MemoTag =
  | "anti-air"
  | "punish"
  | "oki"
  | "neutral"
  | "combo"
  | "defense"
  | "drive"
  | "habit";

/** タグの日本語ラベル */
export const MEMO_TAG_LABELS: Record<MemoTag, string> = {
  "anti-air": "対空",
  punish: "確反",
  oki: "起き攻め",
  neutral: "立ち回り",
  combo: "コンボ",
  defense: "防御",
  drive: "ドライブ",
  habit: "クセ",
};

/** 全タグ一覧 */
export const ALL_MEMO_TAGS: MemoTag[] = Object.keys(MEMO_TAG_LABELS) as MemoTag[];

/** クイックアドバイスの1問1答ペア */
export interface QuickAdviceEntry {
  id: string;
  question: string;
  answer: string;
  /** AIから抽出したメタデータ */
  meta: {
    opponent: string | null;
    tags: MemoTag[];
    keyPoints: string;
  };
  createdAt: string;
}
