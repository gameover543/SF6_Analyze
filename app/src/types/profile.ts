/** ユーザープロフィール */
export interface UserProfile {
  /** 使用キャラ（メイン） */
  mainCharacter: string;
  /** サブキャラ（任意） */
  subCharacters: string[];
  /** 操作タイプ */
  controlType: "classic" | "modern";
  /** 現在のランク帯 */
  rank: string;
  /** マスターレーティング（MR、マスター帯の場合） */
  masterRating?: number;
  /** 苦手なキャラ */
  weakAgainst: string[];
  /** 自覚している課題 */
  challenges: string[];
  /** 現在の練習テーマ */
  currentFocus?: string;
  /** BBC Short ID（任意） */
  bbcShortId?: string;
  /** プロフィール作成日 */
  createdAt: string;
  /** 最終更新日 */
  updatedAt: string;
}
