import { GoogleGenerativeAI } from "@google/generative-ai";

/** LLMプロバイダーの種別 */
type LLMProvider = "gemini" | "openai";

/** チャットメッセージ */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** LLMクライアント（プロバイダー切替可能） */
class LLMClient {
  private provider: LLMProvider;

  constructor() {
    // 環境変数でプロバイダーを切替（デフォルト: gemini）
    this.provider = (process.env.LLM_PROVIDER as LLMProvider) || "gemini";
  }

  /** ストリーミング応答：トークンを順次 yield する */
  async *streamChat(
    systemPrompt: string,
    messages: ChatMessage[]
  ): AsyncGenerator<string> {
    switch (this.provider) {
      case "gemini":
        yield* this.streamChatGemini(systemPrompt, messages);
        break;
      case "openai":
        yield* this.streamChatOpenAI(systemPrompt, messages);
        break;
      default:
        throw new Error(`未対応のLLMプロバイダー: ${this.provider}`);
    }
  }

  private async *streamChatGemini(
    systemPrompt: string,
    messages: ChatMessage[]
  ): AsyncGenerator<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEYが設定されていません");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    // Gemini形式の履歴に変換
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    // ストリーミングAPIで逐次取得
    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  private async *streamChatOpenAI(
    systemPrompt: string,
    messages: ChatMessage[]
  ): AsyncGenerator<string> {
    // サービス化時に実装
    // OpenAI SDKをインストール後、GPT-4o-miniを使用
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.body) throw new Error("ストリームを取得できませんでした");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* JSONパースエラーは無視 */ }
      }
    }
  }
}

export const llm = new LLMClient();
