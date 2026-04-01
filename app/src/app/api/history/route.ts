import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { put, del, list } from "@vercel/blob";

// BLOB_READ_WRITE_TOKEN が設定されていれば Vercel Blob を使用、なければ fs（ローカル開発用）
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// Blob ストレージ内のプレフィックス
const BLOB_PREFIX = "sf6-history/";

// ローカル開発用：チャット履歴の保存先ディレクトリ（.data/ は .gitignore 対象）
const HISTORY_DIR = path.join(process.cwd(), ".data", "history");

/** セッションIDのバリデーション（UUIDフォーマットのみ許可）*/
function validateSessionId(sessionId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    sessionId
  );
}

// ─── ローカル fs バックエンド ─────────────────────────────────────

/** セッションIDから履歴ファイルのパスを生成 */
function getFilePath(sessionId: string): string {
  return path.join(HISTORY_DIR, `${sessionId}.json`);
}

/** 保存先ディレクトリが存在しなければ作成 */
function ensureDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

// ─── Vercel Blob バックエンド ─────────────────────────────────────

/** Blob のパスネームを生成 */
function getBlobPathname(sessionId: string): string {
  return `${BLOB_PREFIX}${sessionId}.json`;
}

// ─── API ルートハンドラー ─────────────────────────────────────────

/** GET /api/history?sessionId=xxx — 履歴を取得 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId || !validateSessionId(sessionId)) {
    return NextResponse.json({ messages: [] });
  }

  try {
    if (USE_BLOB) {
      // Vercel Blob からプレフィックスで検索して取得
      const { blobs } = await list({ prefix: getBlobPathname(sessionId) });
      if (blobs.length === 0) {
        return NextResponse.json({ messages: [] });
      }
      const res = await fetch(blobs[0].url);
      if (!res.ok) return NextResponse.json({ messages: [] });
      const messages = await res.json();
      return NextResponse.json({ messages });
    } else {
      // ローカル fs から読み込み
      const filePath = getFilePath(sessionId);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ messages: [] });
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const messages = JSON.parse(raw);
      return NextResponse.json({ messages });
    }
  } catch {
    // 読み取りエラーは空配列で返す（クライアントのフォールバック任せ）
    return NextResponse.json({ messages: [] });
  }
}

/** POST /api/history — 履歴を保存 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { sessionId, messages } = body as {
      sessionId: string;
      messages: Array<{ role: string; content: string }>;
    };

    if (!sessionId || !validateSessionId(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }
    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    if (USE_BLOB) {
      if (messages.length === 0) {
        // 空配列 = クリア操作：Blob を削除
        const { blobs } = await list({ prefix: getBlobPathname(sessionId) });
        if (blobs.length > 0) {
          await del(blobs[0].url);
        }
      } else {
        // 直近50件のみ保持（トークン節約）
        const trimmed = messages.slice(-50);
        await put(getBlobPathname(sessionId), JSON.stringify(trimmed), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
        });
      }
    } else {
      ensureDir();
      const filePath = getFilePath(sessionId);

      if (messages.length === 0) {
        // 空配列 = クリア操作：ファイルを削除
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        // 直近50件のみ保持（トークン節約）
        const trimmed = messages.slice(-50);
        fs.writeFileSync(filePath, JSON.stringify(trimmed), "utf-8");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
