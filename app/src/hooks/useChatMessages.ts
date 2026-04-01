"use client";
import { useState, useEffect } from "react";
import type { UserProfile } from "@/types/profile";
import { saveChatHistory, getOrCreateSessionId } from "@/lib/profile-storage";

/** タイムアウト付きfetchを指数バックオフでリトライする */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2,
  timeoutMs: number = 45000
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      // 5xx サーバーエラーはリトライ対象
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      // タイムアウト・ネットワークエラーはリトライ対象
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
    }
  }

  throw lastError;
}

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

    try {
      const res = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          characterSlugs: selectedChars,
          profile,
          mode,
          opponentChar: opponentChar || null,
        }),
      });

      // HTTPレベルのエラー（4xx等）
      if (!res.ok && res.status < 500) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: getErrorMessage(null, res.status) },
        ]);
        return;
      }

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `⚠️ ${data.error}` },
        ]);
      } else {
        // カウンセリングモード：プロフィールJSONの抽出を試みる
        if (mode === "counseling") {
          const extractedProfile = extractProfileFromReply(data.reply);
          if (extractedProfile) {
            onProfileExtracted(extractedProfile);
            const cleanReply = cleanReplyForDisplay(data.reply);
            setMessages([
              ...newMessages,
              { role: "assistant", content: cleanReply },
            ]);
            return;
          }
        }

        setMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: getErrorMessage(err),
        },
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
