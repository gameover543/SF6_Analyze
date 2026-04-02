import { NextRequest, NextResponse } from "next/server";
import { llm, type ChatMessage } from "@/lib/llm";
import { getCharacterFrameData, filterMovesByControlType } from "@/lib/frame-data";
import {
  buildCoachSystemPrompt,
  buildCounselingPrompt,
  buildQuickAdvicePrompt,
  formatFrameDataForContext,
} from "@/lib/prompts";
import { buildKnowledgeContext, buildMatchupKnowledgeContext, detectOpponent } from "@/lib/knowledge";
import type { UserProfile } from "@/types/profile";
import { CHAR_JP } from "@/lib/characters";

// --- レート制限（IP単位、1日20回まで） ---
const DAILY_LIMIT = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // 期限切れ or 新規 → リセット
  if (!entry || now > entry.resetAt) {
    const resetAt = now + 24 * 60 * 60 * 1000; // 24時間後
    rateLimitMap.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

export async function POST(request: NextRequest) {
  // レート制限チェック
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "本日のAI質問回数の上限（20回）に達しました。明日またご利用ください。" },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  try {
    const body = await request.json();
    const { messages, characterSlugs, profile, mode, opponentChar } = body as {
      messages: ChatMessage[];
      characterSlugs?: string[];
      profile?: UserProfile | null;
      mode?: "counseling" | "coaching" | "matchup" | "quick";
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
    } else if (mode === "quick") {
      // クイックアドバイスモード: 1問1答、短い応答
      const latestQuestion = messages[messages.length - 1]?.content || "";
      const mainSlugQ = profile?.mainCharacter;
      const detectedOpponentQ = latestQuestion ? detectOpponent(latestQuestion, mainSlugQ) : null;
      const controlTypeQ = profile?.controlType || "classic";

      let frameDataContextQ = "";
      if (mainSlugQ) {
        try {
          const data = getCharacterFrameData(mainSlugQ);
          const filteredMoves = filterMovesByControlType(data.moves, controlTypeQ);
          frameDataContextQ += formatFrameDataForContext(data.character_name, filteredMoves, latestQuestion);
          frameDataContextQ += "\n";
        } catch { /* スキップ */ }
      }
      if (detectedOpponentQ && detectedOpponentQ !== mainSlugQ) {
        try {
          const data = getCharacterFrameData(detectedOpponentQ);
          const filteredMoves = filterMovesByControlType(data.moves, controlTypeQ);
          frameDataContextQ += formatFrameDataForContext(data.character_name, filteredMoves, latestQuestion);
          frameDataContextQ += "\n";
        } catch { /* スキップ */ }
      }

      systemPrompt = buildQuickAdvicePrompt(frameDataContextQ, profile);
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
        "X-RateLimit-Remaining": String(remaining),
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
