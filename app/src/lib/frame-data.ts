import type { CharacterFrameData, CharacterInfo, MoveFrameData, ControlType } from "@/types/frame-data";

// 全キャラのフレームデータを静的importで読み込む（Vercel対応）
import dataRyu from "@/data/ryu.json";
import dataLuke from "@/data/luke.json";
import dataJamie from "@/data/jamie.json";
import dataChunli from "@/data/chunli.json";
import dataGuile from "@/data/guile.json";
import dataKimberly from "@/data/kimberly.json";
import dataJuri from "@/data/juri.json";
import dataKen from "@/data/ken.json";
import dataBlanka from "@/data/blanka.json";
import dataDhalsim from "@/data/dhalsim.json";
import dataEhonda from "@/data/ehonda.json";
import dataDeejay from "@/data/deejay.json";
import dataManon from "@/data/manon.json";
import dataMarisa from "@/data/marisa.json";
import dataJp from "@/data/jp.json";
import dataZangief from "@/data/zangief.json";
import dataLily from "@/data/lily.json";
import dataCammy from "@/data/cammy.json";
import dataRashid from "@/data/rashid.json";
import dataAki from "@/data/aki.json";
import dataEd from "@/data/ed.json";
import dataGouki from "@/data/gouki.json";
import dataMbison from "@/data/mbison.json";
import dataTerry from "@/data/terry.json";
import dataMai from "@/data/mai.json";
import dataElena from "@/data/elena.json";
import dataCviper from "@/data/cviper.json";
import dataSagat from "@/data/sagat.json";
import dataAlex from "@/data/alex.json";

/** slug → データのマッピング */
const FRAME_DATA_MAP: Record<string, CharacterFrameData> = {
  ryu: dataRyu as CharacterFrameData,
  luke: dataLuke as CharacterFrameData,
  jamie: dataJamie as CharacterFrameData,
  chunli: dataChunli as CharacterFrameData,
  guile: dataGuile as CharacterFrameData,
  kimberly: dataKimberly as CharacterFrameData,
  juri: dataJuri as CharacterFrameData,
  ken: dataKen as CharacterFrameData,
  blanka: dataBlanka as CharacterFrameData,
  dhalsim: dataDhalsim as CharacterFrameData,
  ehonda: dataEhonda as CharacterFrameData,
  deejay: dataDeejay as CharacterFrameData,
  manon: dataManon as CharacterFrameData,
  marisa: dataMarisa as CharacterFrameData,
  jp: dataJp as CharacterFrameData,
  zangief: dataZangief as CharacterFrameData,
  lily: dataLily as CharacterFrameData,
  cammy: dataCammy as CharacterFrameData,
  rashid: dataRashid as CharacterFrameData,
  aki: dataAki as CharacterFrameData,
  ed: dataEd as CharacterFrameData,
  gouki: dataGouki as CharacterFrameData,
  mbison: dataMbison as CharacterFrameData,
  terry: dataTerry as CharacterFrameData,
  mai: dataMai as CharacterFrameData,
  elena: dataElena as CharacterFrameData,
  cviper: dataCviper as CharacterFrameData,
  sagat: dataSagat as CharacterFrameData,
  alex: dataAlex as CharacterFrameData,
};

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

/** キャラクターのフレームデータを取得（空技名のゴミデータを除外） */
export function getCharacterFrameData(slug: string): CharacterFrameData {
  const data = FRAME_DATA_MAP[slug];
  if (!data) throw new Error(`キャラクター "${slug}" のデータが見つかりません`);
  return {
    ...data,
    moves: data.moves.filter((m) => m.skill && m.skill.trim() !== ""),
  };
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
