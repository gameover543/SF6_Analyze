import { NextRequest, NextResponse } from "next/server";
import { llm, type ChatMessage } from "@/lib/llm";
import { getCharacterFrameData, filterMovesByControlType } from "@/lib/frame-data";
import {
  buildCoachSystemPrompt,
  buildCounselingPrompt,
  formatFrameDataForContext,
} from "@/lib/prompts";
import { buildKnowledgeContext } from "@/lib/knowledge";
import type { UserProfile } from "@/types/profile";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, characterSlugs, profile, mode } = body as {
      messages: ChatMessage[];
      characterSlugs?: string[];
      profile?: UserProfile | null;
      mode?: "counseling" | "coaching";
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "メッセージが必要です" }, { status: 400 });
    }

    let systemPrompt: string;

    if (mode === "counseling") {
      // カウンセリングモード（初回ヒアリング）
      systemPrompt = buildCounselingPrompt();
    } else {
      // コーチングモード（通常会話）
      // プロフィールのメインキャラ + 選択キャラのフレームデータを含める
      const slugs = new Set(characterSlugs || []);

      // プロフィールのメインキャラを自動追加
      if (profile?.mainCharacter) {
        slugs.add(profile.mainCharacter);
      }

      let frameDataContext = "";
      for (const slug of Array.from(slugs).slice(0, 3)) {
        try {
          const data = getCharacterFrameData(slug);
          const controlType = profile?.controlType || "classic";
          const filteredMoves = filterMovesByControlType(data.moves, controlType);
          // 最新のユーザー質問を渡してフレームデータの選択的注入
          const latestQuestion = messages.filter((m: ChatMessage) => m.role === "user").pop()?.content || "";
          frameDataContext += formatFrameDataForContext(data.character_name, filteredMoves, latestQuestion);
          frameDataContext += "\n";
        } catch {
          // キャラデータが見つからない場合はスキップ
        }
      }

      // プロ選手のナレッジコンテキストを生成
      const recentMessages = messages
        .filter((m: ChatMessage) => m.role === "user")
        .slice(-3)
        .map((m: ChatMessage) => m.content);
      const knowledgeContext = buildKnowledgeContext(
        Array.from(slugs),
        recentMessages
      );

      systemPrompt = buildCoachSystemPrompt(frameDataContext, profile, knowledgeContext);
    }

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
