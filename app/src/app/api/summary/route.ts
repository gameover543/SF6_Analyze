import { NextRequest, NextResponse } from "next/server";
import { llm } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm";

/**
 * コーチングセッションの要約を生成するAPIエンドポイント。
 * 会話履歴を受け取り、「今日学んだこと」と「次の練習テーマ」をLLMで生成して返す。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body as { messages: ChatMessage[] };

    // ユーザーの発言が2回以上ないと要約の意味がない
    const userMessages = messages?.filter((m) => m.role === "user") ?? [];
    if (userMessages.length < 2) {
      return NextResponse.json({ error: "会話が短すぎます" }, { status: 400 });
    }

    const systemPrompt = `あなたはSF6（ストリートファイター6）のコーチです。
以下のコーチングセッションの会話を振り返り、ユーザーに向けた実践的なまとめを作成してください。

以下の形式で、Markdownで回答してください（余計な前置きは不要）:

## 今日学んだこと
- （箇条書きで3〜5項目。具体的な技名・フレーム数・状況があれば積極的に含める）

## 次の練習テーマ
- （箇条書きで2〜3項目。次のセッションで意識すべき練習内容を具体的に）

会話の内容を踏まえて、ユーザーにとって実践的なまとめを作成してください。`;

    // ストリームを内部で全収集してJSONとして返す
    let summary = "";
    for await (const chunk of llm.streamChat(systemPrompt, messages)) {
      summary += chunk;
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summary API error:", error);
    return NextResponse.json(
      { error: "要約の生成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
