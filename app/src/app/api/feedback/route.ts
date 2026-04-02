import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { put, list } from "@vercel/blob";

// Vercel Blob or ローカルfs切替
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = "sf6-ai-feedback/";
const FEEDBACK_DIR = path.join(process.cwd(), ".data", "ai-feedback");

function ensureDir(): void {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

/** AI回答へのフィードバックを保存 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, rating, comment, profile } = body as {
      question: string;
      answer: string;
      rating: "good" | "bad";
      comment?: string;
      profile?: { mainCharacter?: string; rank?: string } | null;
    };

    if (!question || !answer || !rating) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const entry = {
      id: crypto.randomUUID(),
      question,
      answer: answer.slice(0, 500), // 回答は500文字まで保存
      rating,
      comment: comment?.slice(0, 200) || "",
      mainCharacter: profile?.mainCharacter || "",
      rank: profile?.rank || "",
      createdAt: new Date().toISOString(),
    };

    if (USE_BLOB) {
      // Vercel Blob: 日付別ファイルに追記
      const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const blobPath = `${BLOB_PREFIX}${dateKey}.json`;

      // 既存データを読み込み
      let existing: typeof entry[] = [];
      try {
        const blobs = await list({ prefix: blobPath });
        if (blobs.blobs.length > 0) {
          const res = await fetch(blobs.blobs[0].url);
          existing = await res.json();
        }
      } catch { /* 新規ファイル */ }

      existing.push(entry);
      await put(blobPath, JSON.stringify(existing, null, 2), {
        access: "public",
        addRandomSuffix: false,
      });
    } else {
      // ローカルfs: 日付別ファイルに追記
      ensureDir();
      const dateKey = new Date().toISOString().slice(0, 10);
      const filePath = path.join(FEEDBACK_DIR, `${dateKey}.json`);

      let existing: typeof entry[] = [];
      try {
        if (fs.existsSync(filePath)) {
          existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      } catch { /* 新規ファイル */ }

      existing.push(entry);
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

/** フィードバック一覧取得（管理用） */
export async function GET() {
  try {
    let allFeedback: Record<string, unknown>[] = [];

    if (USE_BLOB) {
      const blobs = await list({ prefix: BLOB_PREFIX });
      for (const blob of blobs.blobs.slice(-7)) { // 直近7日分
        try {
          const res = await fetch(blob.url);
          const data = await res.json();
          allFeedback = allFeedback.concat(data);
        } catch { /* スキップ */ }
      }
    } else {
      ensureDir();
      const files = fs.readdirSync(FEEDBACK_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .slice(-7); // 直近7日分

      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR, file), "utf-8"));
          allFeedback = allFeedback.concat(data);
        } catch { /* スキップ */ }
      }
    }

    return NextResponse.json(allFeedback);
  } catch (error) {
    console.error("Feedback GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
