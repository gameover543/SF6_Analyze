import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { put, del, list } from "@vercel/blob";

// Vercel Blob or ローカルfs切替
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = "sf6-memos/";
const MEMOS_DIR = path.join(process.cwd(), ".data", "memos");

/** セッションIDのバリデーション */
function validateSessionId(sessionId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    sessionId
  );
}

function getFilePath(sessionId: string): string {
  return path.join(MEMOS_DIR, `${sessionId}.json`);
}

function ensureDir(): void {
  if (!fs.existsSync(MEMOS_DIR)) {
    fs.mkdirSync(MEMOS_DIR, { recursive: true });
  }
}

function getBlobPathname(sessionId: string): string {
  return `${BLOB_PREFIX}${sessionId}.json`;
}

/** GET /api/memos?sessionId=xxx — メモ一覧を取得 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !validateSessionId(sessionId)) {
    return NextResponse.json({ memos: [] });
  }

  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: getBlobPathname(sessionId) });
      if (blobs.length === 0) return NextResponse.json({ memos: [] });
      const res = await fetch(blobs[0].url);
      if (!res.ok) return NextResponse.json({ memos: [] });
      const memos = await res.json();
      return NextResponse.json({ memos });
    } else {
      const filePath = getFilePath(sessionId);
      if (!fs.existsSync(filePath)) return NextResponse.json({ memos: [] });
      const raw = fs.readFileSync(filePath, "utf-8");
      return NextResponse.json({ memos: JSON.parse(raw) });
    }
  } catch {
    return NextResponse.json({ memos: [] });
  }
}

/** POST /api/memos — メモ一覧を保存 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { sessionId, memos } = body as { sessionId: string; memos: unknown[] };

    if (!sessionId || !validateSessionId(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }
    if (!Array.isArray(memos)) {
      return NextResponse.json({ error: "Invalid memos" }, { status: 400 });
    }

    // 最大500件に制限
    const trimmed = memos.slice(0, 500);

    if (USE_BLOB) {
      if (trimmed.length === 0) {
        const { blobs } = await list({ prefix: getBlobPathname(sessionId) });
        if (blobs.length > 0) await del(blobs[0].url);
      } else {
        await put(getBlobPathname(sessionId), JSON.stringify(trimmed), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
        });
      }
    } else {
      ensureDir();
      const filePath = getFilePath(sessionId);
      if (trimmed.length === 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } else {
        fs.writeFileSync(filePath, JSON.stringify(trimmed), "utf-8");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
