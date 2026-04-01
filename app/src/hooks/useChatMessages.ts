"use client";
import { useState, useEffect } from "react";
import type { UserProfile } from "@/types/profile";
import { saveChatHistory, getOrCreateSessionId } from "@/lib/profile-storage";

/** エラーオブジェクトからユーザー向けメッセージを生成する */
function getErrorMessage(err: unknown, status?: number): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "応答がタイムアウトしました。AIが混雑しているようです。しばらく待ってから再度お試しください。";
  }
  if (err instanceof TypeError) {
    return "ネットワークに接続できませんでした。インターネット接続を確認してください。";
  }
  if (status !== undefined && status >= 500) {
    return "サーバーで問題が発生しました。しばらく待ってから再度お試しください。";
  }
  return "通信エラーが発生しました。もう一度お試しください。";
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/** AIの回答からプロフィールJSONを抽出する */
function extractProfileFromReply(reply: string): UserProfile | null {
  const match = reply.match(/```json:profile\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    return {
      mainCharacter: data.mainCharacter || "",
      subCharacters: data.subCharacters || [],
      controlType: data.controlType || "classic",
      rank: data.rank || "",
      masterRating: data.masterRating || undefined,
      weakAgainst: data.weakAgainst || [],
      challenges: data.challenges || [],
      currentFocus: data.currentFocus || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** プロフィールJSON部分を除去して表示用テキストにする */
function cleanReplyForDisplay(reply: string): string {
  return reply.replace(/```json:profile\s*\n[\s\S]*?\n```/, "").trim();
}

interface UseChatMessagesParams {
  selectedChars: string[];
  profile: UserProfile | null;
  mode: "counseling" | "coaching" | "matchup";
  /** マッチアップモード時の対戦相手キャラslug */
  opponentChar?: string | null;
  /** カウンセリング完了時にプロフィールが抽出されたコールバック */
  onProfileExtracted: (profile: UserProfile) => void;
}

export function useChatMessages({
  selectedChars,
  profile,
  mode,
  opponentChar,
  onProfileExtracted,
}: UseChatMessagesParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // コーチング・マッチアップモードではメッセージ変更のたびに履歴を保存
  useEffect(() => {
    if (messages.length > 0 && (mode === "coaching" || mode === "matchup")) {
      // LocalStorageに即時保存（オフライン時のフォールバック）
      saveChatHistory(messages);
      // サーバーにも非同期で同期（失敗しても無視）
      const sessionId = getOrCreateSessionId();
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages }),
      }).catch(() => {
        // サーバー保存失敗はサイレントに無視（LocalStorageが保険）
      });
    }
  }, [messages, mode]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // ストリーミング受信中に蓄積するテキスト
    let streamedContent = "";

    try {
      // 接続タイムアウト（初回レスポンスまで45秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            characterSlugs: selectedChars,
            profile,
            mode,
            opponentChar: opponentChar || null,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (err) {
        clearTimeout(timeoutId);
        setMessages([
          ...newMessages,
          { role: "assistant", content: getErrorMessage(err) },
        ]);
        return;
      }

      // HTTPエラー（4xx / 5xx）はストリーム開始前に検出
      if (!res.ok || !res.body) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: getErrorMessage(null, res.status) },
        ]);
        return;
      }

      // 空のassistantメッセージを追加してストリーミング開始を示す
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // 複数チャンクにまたがるSSE行に対応するバッファ
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // 末尾の不完全な行はバッファに残す
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setMessages([
                ...newMessages,
                { role: "assistant", content: `⚠️ ${parsed.error}` },
              ]);
              return;
            }
            if (parsed.chunk) {
              streamedContent += parsed.chunk;
              setMessages([
                ...newMessages,
                { role: "assistant", content: streamedContent },
              ]);
            }
          } catch { /* JSONパースエラーは無視 */ }
        }
      }

      // カウンセリングモード：全文受信後にプロフィールJSONを抽出
      if (mode === "counseling" && streamedContent) {
        const extractedProfile = extractProfileFromReply(streamedContent);
        if (extractedProfile) {
          onProfileExtracted(extractedProfile);
          const cleanReply = cleanReplyForDisplay(streamedContent);
          setMessages([...newMessages, { role: "assistant", content: cleanReply }]);
        }
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: getErrorMessage(err) },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
