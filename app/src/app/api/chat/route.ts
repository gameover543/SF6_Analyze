import { NextRequest, NextResponse } from "next/server";
import { llm, type ChatMessage } from "@/lib/llm";
import { getCharacterFrameData, filterMovesByControlType } from "@/lib/frame-data";
import {
  buildCoachSystemPrompt,
  buildCounselingPrompt,
  formatFrameDataForContext,
} from "@/lib/prompts";
import { buildKnowledgeContext, buildMatchupKnowledgeContext, detectOpponent } from "@/lib/knowledge";
import type { UserProfile } from "@/types/profile";
import { CHAR_JP } from "@/lib/characters";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, characterSlugs, profile, mode, opponentChar } = body as {
      messages: ChatMessage[];
      characterSlugs?: string[];
      profile?: UserProfile | null;
      mode?: "counseling" | "coaching" | "matchup";
      opponentChar?: string | null;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "メッセージが必要です" }, { status: 400 });
    }

    let systemPrompt: string;

    if (mode === "counseling") {
      // カウンセリングモード（初回ヒアリング）
      systemPrompt = buildCounselingPrompt();
    } else if (mode === "matchup" && profile?.mainCharacter && opponentChar) {
      // マッチアップ特化モード：メインキャラ + 対戦相手のフレームデータを含める
      const mainSlug = profile.mainCharacter;
      const latestQuestion =
        messages.filter((m: ChatMessage) => m.role === "user").pop()?.content || "";
      const controlType = profile.controlType || "classic";

      let frameDataContext = "";
      // メインキャラのフレームデータ
      try {
        const data = getCharacterFrameData(mainSlug);
        const filteredMoves = filterMovesByControlType(data.moves, controlType);
        frameDataContext += formatFrameDataForContext(data.character_name, filteredMoves, latestQuestion);
        frameDataContext += "\n";
      } catch { /* キャラデータなし */ }
      // 対戦相手のフレームデータ
      try {
        const data = getCharacterFrameData(opponentChar);
        const filteredMoves = filterMovesByControlType(data.moves, controlType);
        frameDataContext += formatFrameDataForContext(data.character_name, filteredMoves, latestQuestion);
        frameDataContext += "\n";
      } catch { /* キャラデータなし */ }

      // マッチアップ特化ナレッジを生成
      const recentMessages = messages
        .filter((m: ChatMessage) => m.role === "user")
        .slice(-3)
        .map((m: ChatMessage) => m.content);
      const knowledgeContext = buildMatchupKnowledgeContext(mainSlug, opponentChar, recentMessages);

      // キャラ名（日本語）を解決してプロンプトに渡す
      const mainName = CHAR_JP[mainSlug] || mainSlug;
      const opponentName = CHAR_JP[opponentChar] || opponentChar;

      systemPrompt = buildCoachSystemPrompt(
        frameDataContext,
        profile,
        knowledgeContext,
        { mainName, opponentName }
      );
    } else {
      // コーチングモード（通常会話）
      // プロフィールのメインキャラ + 選択キャラのフレームデータを含める
      const slugs = new Set(characterSlugs || []);

      // プロフィールのメインキャラを自動追加
      if (profile?.mainCharacter) {
        slugs.add(profile.mainCharacter);
      }

      // 最新のユーザー質問を取得（フレームデータ選択的注入 + 対戦相手検出に使用）
      const latestQuestion = messages.filter((m: ChatMessage) => m.role === "user").pop()?.content || "";

      // 質問に対戦相手キャラが含まれている場合は自動的にフレームデータを追加
      // 例:「ケンの昇竜って何フレ？」→ ケンのフレームデータも注入する
      const mainSlug = profile?.mainCharacter;
      const detectedOpponent = latestQuestion ? detectOpponent(latestQuestion, mainSlug) : null;
      if (detectedOpponent) {
        slugs.add(detectedOpponent);
      }

      let frameDataContext = "";
      for (const slug of Array.from(slugs).slice(0, 3)) {
        try {
          const data = getCharacterFrameData(slug);
          const controlType = profile?.controlType || "classic";
          const filteredMoves = filterMovesByControlType(data.moves, controlType);
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

    // SSE（Server-Sent Events）でトークンを逐次送信
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of llm.streamChat(systemPrompt, messages)) {
            // SSE形式: "data: <JSON>\n\n"
            const line = `data: ${JSON.stringify({ chunk })}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          console.error("Streaming error:", err);
          const errLine = `data: ${JSON.stringify({ error: "AIの応答中にエラーが発生しました" })}\n\n`;
          controller.enqueue(encoder.encode(errLine));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "AIの応答中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
