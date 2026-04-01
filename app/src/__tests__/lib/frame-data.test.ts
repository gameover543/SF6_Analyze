/**
 * frame-data.ts のユニットテスト
 *
 * テスト対象:
 *   - getCharacterFrameData: 有効/無効スラッグ
 *   - filterMovesByControlType: classic/modern フィルタ
 *   - categorizeMoves: 技種別の分類
 *   - getFrameAdvantageColor: フレーム値による色クラス
 */

import { describe, it, expect } from "vitest";
import {
  getCharacterFrameData,
  filterMovesByControlType,
  categorizeMoves,
  getFrameAdvantageColor,
  CHARACTER_LIST,
} from "@/lib/frame-data";
import type { MoveFrameData } from "@/types/frame-data";

// テスト用モック技データ
const makeMock = (
  overrides: Partial<MoveFrameData>
): MoveFrameData =>
  ({
    name: "テスト技",
    move_type: "NORMAL",
    command: "5LP",
    command_modern: "LP",
    startup: "5",
    active: "3",
    recovery: "12",
    cancel: "-",
    hit: "+1",
    block: "-2",
    drive: "0",
    super_art: "-",
    invincibility: "-",
    ...overrides,
  } as MoveFrameData);

// --- getCharacterFrameData ---

describe("getCharacterFrameData", () => {
  it("有効なスラッグでデータを返す", () => {
    const data = getCharacterFrameData("ryu");
    expect(data).toBeDefined();
    expect(data).toHaveProperty("moves");
  });

  it("存在しないスラッグはエラーをスロー", () => {
    expect(() => getCharacterFrameData("unknown_char")).toThrow(
      'キャラクター "unknown_char" のデータが見つかりません'
    );
  });

  it("CHARACTER_LIST に含まれる全スラッグでデータを取得できる", () => {
    for (const char of CHARACTER_LIST) {
      expect(() => getCharacterFrameData(char.slug)).not.toThrow();
    }
  });
});

// --- filterMovesByControlType ---

describe("filterMovesByControlType", () => {
  const moves: MoveFrameData[] = [
    makeMock({ command: "5LP", command_modern: "LP" }),     // 両方あり
    makeMock({ command: "236LP", command_modern: null }),   // クラシックのみ
    makeMock({ command: null, command_modern: "SP" }),      // モダンのみ
  ];

  it("classic: command が null でない技だけ返す", () => {
    const result = filterMovesByControlType(moves, "classic");
    expect(result).toHaveLength(2);
    result.forEach((m) => expect(m.command).not.toBeNull());
  });

  it("modern: command_modern が null でない技だけ返す", () => {
    const result = filterMovesByControlType(moves, "modern");
    expect(result).toHaveLength(2);
    result.forEach((m) => expect(m.command_modern).not.toBeNull());
  });
});

// --- categorizeMoves ---

describe("categorizeMoves", () => {
  const moves: MoveFrameData[] = [
    makeMock({ move_type: "NORMAL" }),
    makeMock({ move_type: "NORMAL" }),
    makeMock({ move_type: "UNIQUE" }),
    makeMock({ move_type: "SPECIAL" }),
    makeMock({ move_type: "SA" }),
    makeMock({ move_type: "THROW" }),
    makeMock({ move_type: "COMMON" }),
  ];

  it("技種別ごとに正しく分類される", () => {
    const result = categorizeMoves(moves);
    expect(result.normal).toHaveLength(2);
    expect(result.unique).toHaveLength(1);
    expect(result.special).toHaveLength(1);
    expect(result.sa).toHaveLength(1);
    expect(result.throw).toHaveLength(1);
    expect(result.common).toHaveLength(1);
  });

  it("空配列を渡すと全カテゴリが空になる", () => {
    const result = categorizeMoves([]);
    Object.values(result).forEach((arr) => expect(arr).toHaveLength(0));
  });
});

// --- getFrameAdvantageColor ---

describe("getFrameAdvantageColor", () => {
  it("正の値は青色クラス", () => {
    expect(getFrameAdvantageColor("+2")).toBe("text-blue-400");
    expect(getFrameAdvantageColor("3")).toBe("text-blue-400");
  });

  it("負の値は赤色クラス", () => {
    expect(getFrameAdvantageColor("-4")).toBe("text-red-400");
  });

  it("0 は黄色クラス", () => {
    expect(getFrameAdvantageColor("0")).toBe("text-yellow-400");
  });

  it("数値以外（KD, - 等）はグレークラス", () => {
    expect(getFrameAdvantageColor("KD")).toBe("text-gray-400");
    expect(getFrameAdvantageColor("-")).toBe("text-gray-400");
    expect(getFrameAdvantageColor("")).toBe("text-gray-400");
  });
});
