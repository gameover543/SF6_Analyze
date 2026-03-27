import { NextRequest, NextResponse } from "next/server";
import { llm, type ChatMessage } from "@/lib/llm";
import { getCharacterFrameData, filterMovesByControlType } from "@/lib/frame-data";
import { buildCoachSystemPrompt, formatFrameDataForContext } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, characterSlugs } = body as {
      messages: ChatMessage[];
      characterSlugs?: string[];
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "メッセージが必要です" }, { status: 400 });
    }

    // 指定されたキャラのフレームデータをコンテキストに含める
    let frameDataContext = "";
    const slugs = characterSlugs || [];

    for (const slug of slugs.slice(0, 3)) {
      // 最大3キャラ分（トークン節約）
      try {
        const data = getCharacterFrameData(slug);
        const classicMoves = filterMovesByControlType(data.moves, "classic");
        frameDataContext += formatFrameDataForContext(data.character_name, classicMoves);
        frameDataContext += "\n";
      } catch {
        // キャラデータが見つからない場合はスキップ
      }
    }

    const systemPrompt = buildCoachSystemPrompt(frameDataContext);
    const reply = await llm.chat(systemPrompt, messages);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "AIの応答中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
