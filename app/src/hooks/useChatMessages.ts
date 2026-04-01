"use client";
import { useState, useEffect } from "react";
import type { UserProfile } from "@/types/profile";
import { saveChatHistory } from "@/lib/profile-storage";

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
  mode: "counseling" | "coaching";
  /** カウンセリング完了時にプロフィールが抽出されたコールバック */
  onProfileExtracted: (profile: UserProfile) => void;
}

export function useChatMessages({
  selectedChars,
  profile,
  mode,
  onProfileExtracted,
}: UseChatMessagesParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // コーチングモードではメッセージ変更のたびに履歴を保存
  useEffect(() => {
    if (messages.length > 0 && mode === "coaching") {
      saveChatHistory(messages);
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          characterSlugs: selectedChars,
          profile,
          mode,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `エラー: ${data.error}` },
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
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "通信エラーが発生しました。もう一度お試しください。",
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
