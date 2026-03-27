/** 1技分のフレームデータ */
export interface MoveFrameData {
  web_id: string;
  name: string;           // 内部名 (例: "(5LP)")
  skill: string;          // 表示名 (例: "立ち弱P（杯打）")
  move_type: string;      // NORMAL, SPECIAL, SA, UNIQUE, COMMON, THROW

  // コマンド（Classic / Modern）
  command: string | null;
  command_modern: string | null;

  // フレームデータ
  startup_frame: string;
  active_frame: string;
  recovery_frame: string;
  total_frame: string;
  block_frame: string;    // ガード時硬直差
  hit_frame: string;      // ヒット時硬直差

  // 属性・ダメージ
  attribute: string;
  damage: string;
  combo_correct: string[];

  // キャンセル
  cancel: string;
  web_cancel: string;

  // ゲージ関連
  drive_gauge_gain_hit: string;
  drive_gauge_gain_parry: string;
  drive_gauge_lose_dguard: string;
  drive_gauge_lose_punish: string;
  sa_gauge_gain: string;

  // 備考
  note: string[];
  translation: string;
}

/** キャラクター全技データ */
export interface CharacterFrameData {
  character_name: string;
  slug: string;
  version: string;
  moves: MoveFrameData[];
  extracted_at: string;
}

/** キャラクター基本情報 */
export interface CharacterInfo {
  name: string;
  slug: string;
}

/** 操作タイプ */
export type ControlType = "classic" | "modern";
