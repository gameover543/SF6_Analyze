/**
 * API ルートのユニットテスト
 *
 * テスト対象:
 *   - GET /api/characters   → キャラクター一覧を返す
 *   - GET /api/characters/[slug] → 個別フレームデータ / 404
 *
 * next/server の NextResponse を軽量モックで置き換え、
 * Next.js ランタイムなしで実行できるようにする。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- next/server モック ---
// NextResponse.json() が返すオブジェクトは
// { _data, _status } 形式にして後からアサートする。
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      _data: data,
      _status: init?.status ?? 200,
      // テスト内で await response.json() のように書けるよう互換メソッドを用意
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
  NextRequest: class {
    constructor(public url: string) {}
  },
}));

// next/server モック後に各ルートをインポート
import { GET as getCharacters } from "@/app/api/characters/route";
import { GET as getCharacterBySlug } from "@/app/api/characters/[slug]/route";
import { CHARACTER_LIST } from "@/lib/frame-data";

// テスト用の簡易 NextRequest 生成ヘルパー
const makeRequest = (url = "http://localhost/") =>
  new Request(url) as unknown as import("next/server").NextRequest;

// params を Promise で包んで渡す（Next.js 15+ の仕様に合わせる）
const makeParams = (slug: string) =>
  Promise.resolve({ slug }) as Promise<{ slug: string }>;

beforeEach(() => {
  vi.clearAllMocks();
});

// --- GET /api/characters ---

describe("GET /api/characters", () => {
  it("ステータス 200 でキャラクター一覧を返す", async () => {
    const response = await getCharacters();
    const res = response as unknown as { _data: unknown; _status: number };
    expect(res._status).toBe(200);
    expect(res._data).toEqual(CHARACTER_LIST);
  });

  it("レスポンスにスラッグが含まれる", async () => {
    const response = await getCharacters();
    const res = response as unknown as { _data: Array<{ slug: string }> };
    const slugs = res._data.map((c) => c.slug);
    expect(slugs).toContain("ryu");
    expect(slugs).toContain("jamie");
    expect(slugs).toContain("ken");
  });

  it("少なくとも 29 キャラクターを返す", async () => {
    const response = await getCharacters();
    const res = response as unknown as { _data: unknown[] };
    expect(res._data.length).toBeGreaterThanOrEqual(29);
  });
});

// --- GET /api/characters/[slug] ---

describe("GET /api/characters/[slug]", () => {
  it("有効なスラッグでフレームデータを返す（ステータス 200）", async () => {
    const req = makeRequest("http://localhost/api/characters/ryu");
    const response = await getCharacterBySlug(req, { params: makeParams("ryu") });
    const res = response as unknown as { _data: unknown; _status: number };
    expect(res._status).toBe(200);
    expect(res._data).toHaveProperty("moves");
  });

  it("存在しないスラッグで 404 を返す", async () => {
    const req = makeRequest("http://localhost/api/characters/does_not_exist");
    const response = await getCharacterBySlug(req, {
      params: makeParams("does_not_exist"),
    });
    const res = response as unknown as { _data: { error: string }; _status: number };
    expect(res._status).toBe(404);
    expect(res._data).toHaveProperty("error");
    expect(res._data.error).toBe("キャラクターが見つかりません");
  });

  it("jamie のデータが返る", async () => {
    const req = makeRequest("http://localhost/api/characters/jamie");
    const response = await getCharacterBySlug(req, { params: makeParams("jamie") });
    const res = response as unknown as { _data: { moves: unknown[] }; _status: number };
    expect(res._status).toBe(200);
    expect(Array.isArray(res._data.moves)).toBe(true);
    expect(res._data.moves.length).toBeGreaterThan(0);
  });
});
