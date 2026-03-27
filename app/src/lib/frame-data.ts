import { readFileSync } from "fs";
import { join } from "path";
import type { CharacterFrameData, CharacterInfo, MoveFrameData, ControlType } from "@/types/frame-data";

/** フレームデータのディレクトリパス */
const DATA_DIR = join(process.cwd(), "..", "data", "frame_data");

/** キャラクター一覧（表示順） */
export const CHARACTER_LIST: CharacterInfo[] = [
  // ベースロスター
  { name: "Ryu", slug: "ryu" },
  { name: "Luke", slug: "luke" },
  { name: "Jamie", slug: "jamie" },
  { name: "Chun-Li", slug: "chunli" },
  { name: "Guile", slug: "guile" },
  { name: "Kimberly", slug: "kimberly" },
  { name: "Juri", slug: "juri" },
  { name: "Ken", slug: "ken" },
  { name: "Blanka", slug: "blanka" },
  { name: "Dhalsim", slug: "dhalsim" },
  { name: "E.Honda", slug: "ehonda" },
  { name: "Dee Jay", slug: "deejay" },
  { name: "Manon", slug: "manon" },
  { name: "Marisa", slug: "marisa" },
  { name: "JP", slug: "jp" },
  { name: "Zangief", slug: "zangief" },
  { name: "Lily", slug: "lily" },
  { name: "Cammy", slug: "cammy" },
  // Year 1 DLC
  { name: "Rashid", slug: "rashid" },
  { name: "A.K.I.", slug: "aki" },
  { name: "Ed", slug: "ed" },
  { name: "Akuma", slug: "gouki" },
  // Year 2 DLC
  { name: "M.Bison", slug: "mbison" },
  { name: "Terry", slug: "terry" },
  { name: "Mai", slug: "mai" },
  { name: "Elena", slug: "elena" },
  // Year 3 DLC
  { name: "C.Viper", slug: "cviper" },
  { name: "Sagat", slug: "sagat" },
  { name: "Alex", slug: "alex" },
];

/** キャラクターのフレームデータをJSONファイルから読み込む */
export function getCharacterFrameData(slug: string): CharacterFrameData {
  const filePath = join(DATA_DIR, `${slug}.json`);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/** 操作タイプに応じて使用可能な技のみフィルタする */
export function filterMovesByControlType(
  moves: MoveFrameData[],
  controlType: ControlType
): MoveFrameData[] {
  if (controlType === "classic") {
    return moves.filter((m) => m.command !== null);
  }
  return moves.filter((m) => m.command_modern !== null);
}

/** 技のカテゴリ分類 */
export function categorizeMoves(moves: MoveFrameData[]) {
  return {
    normal: moves.filter((m) => m.move_type === "NORMAL"),
    unique: moves.filter((m) => m.move_type === "UNIQUE"),
    special: moves.filter((m) => m.move_type === "SPECIAL"),
    sa: moves.filter((m) => m.move_type === "SA"),
    throw: moves.filter((m) => m.move_type === "THROW"),
    common: moves.filter((m) => m.move_type === "COMMON"),
  };
}

/** フレーム値の表示色を判定 */
export function getFrameAdvantageColor(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) return "text-gray-400";
  if (num > 0) return "text-blue-400";
  if (num < 0) return "text-red-400";
  return "text-yellow-400";
}
