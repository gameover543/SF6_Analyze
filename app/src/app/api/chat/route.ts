import { NextRequest, NextResponse } from "next/server";
import { llm, type ChatMessage } from "@/lib/llm";
import { getCharacterFrameData, filterMovesByControlType } from "@/lib/frame-data";
import {
  buildCoachSystemPrompt,
  buildCounselingPrompt,
  formatFrameDataForContext,
} from "@/lib/prompts";
import { buildKnowledgeContext, buildMatchupKnowledgeContext } from "@/lib/knowledge";
import type { UserProfile } from "@/types/profile";

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
      const charNames: Record<string, string> = {
        ryu: "リュウ", luke: "ルーク", jamie: "ジェイミー", chunli: "春麗",
        guile: "ガイル", kimberly: "キンバリー", juri: "ジュリ", ken: "ケン",
        blanka: "ブランカ", dhalsim: "ダルシム", honda: "本田", deejay: "ディージェイ",
        manon: "マノン", marisa: "マリーザ", jp: "JP", zangief: "ザンギエフ",
        lily: "リリー", cammy: "キャミィ", rashid: "ラシード", aki: "A.K.I.",
        ed: "エド", gouki: "豪鬼", mbison: "ベガ", terry: "テリー",
        mai: "舞", elena: "エレナ", cviper: "C.ヴァイパー", sagat: "サガット",
        alex: "アレックス",
      };
      const mainName = charNames[mainSlug] || mainSlug;
      const opponentName = charNames[opponentChar] || opponentChar;

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
