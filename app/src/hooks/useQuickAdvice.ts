"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuickAdviceEntry, MemoTag } from "@/types/memo";
import { loadProfile } from "@/lib/profile-storage";

const STORAGE_KEY = "sf6coach_quick_advice";
const MAX_HISTORY = 20;

/** AI回答からjson:advice_metaを抽出 */
function extractAdviceMeta(text: string): QuickAdviceEntry["meta"] {
  const match = text.match(/```json:advice_meta\s*\n([\s\S]*?)\n```/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        opponent: parsed.opponent || null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        keyPoints: parsed.keyPoints || "",
      };
    } catch { /* フォールバック */ }
  }
  // AI がJSONを出力しなかった場合のフォールバック: キーワードからタグ推定
  return {
    opponent: null,
    tags: detectTagsFromText(text),
    keyPoints: text.split("\n").filter((l) => l.trim()).slice(0, 2).join("\n"),
  };
}

/** テキストからタグをキーワード推定 */
function detectTagsFromText(text: string): MemoTag[] {
  const lower = text.toLowerCase();
  const map: Record<MemoTag, string[]> = {
    "anti-air": ["対空", "昇竜", "落とし"],
    punish: ["確反", "反撃", "確定"],
    oki: ["起き攻め", "重ね", "セットプレイ"],
    neutral: ["立ち回り", "差し合い", "牽制"],
    combo: ["コンボ", "繋がる", "レシピ"],
    defense: ["防御", "切り返し", "暴れ", "守り"],
    drive: ["ドライブ", "ラッシュ", "インパクト", "パリィ"],
    habit: ["クセ", "傾向"],
  };
  return (Object.entries(map) as [MemoTag, string[]][])
    .filter(([, kws]) => kws.some((kw) => lower.includes(kw)))
    .map(([tag]) => tag);
}

/** 表示用にjson:advice_metaを除去 */
function cleanAdvice(text: string): string {
  return text.replace(/```json:advice_meta[\s\S]*?\n```/, "").trim();
}

/** クイックアドバイスの質問・回答・履歴管理 */
export function useQuickAdvice() {
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentMeta, setCurrentMeta] = useState<QuickAdviceEntry["meta"] | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<QuickAdviceEntry[]>([]);

  // 履歴読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* 無視 */ }
  }, []);

  const persistHistory = useCallback((entries: QuickAdviceEntry[]) => {
    const trimmed = entries.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    setHistory(trimmed);
  }, []);

  /** 質問を送信しストリーミング応答を受信 */
  const askQuestion = useCallback(async (question: string) => {
    const profile = loadProfile();
    setCurrentQuestion(question);
    setCurrentAnswer("");
    setCurrentMeta(null);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          profile,
          mode: "quick",
        }),
      });

      if (!res.ok || !res.body) {
        if (res.status === 429) {
          const data = await res.json().catch(() => null);
          setCurrentAnswer(data?.error || "本日のAI質問回数の上限に達しました。明日またご利用ください。");
        } else {
          setCurrentAnswer("エラーが発生しました。もう一度お試しください。");
        }
        setIsStreaming(false);
        return;
      }

      // SSEストリーミング読み取り
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.chunk) {
              fullText += parsed.chunk;
              setCurrentAnswer(cleanAdvice(fullText));
            }
          } catch { /* パース失敗は無視 */ }
        }
      }

      // メタデータ抽出
      const meta = extractAdviceMeta(fullText);
      const cleanAnswer = cleanAdvice(fullText);
      setCurrentAnswer(cleanAnswer);
      setCurrentMeta(meta);

      // 履歴に追加
      const entry: QuickAdviceEntry = {
        id: crypto.randomUUID(),
        question,
        answer: cleanAnswer,
        meta,
        createdAt: new Date().toISOString(),
      };
      persistHistory([entry, ...history]);
    } catch {
      setCurrentAnswer("通信エラーが発生しました。");
    } finally {
      setIsStreaming(false);
    }
  }, [history, persistHistory]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return {
    currentQuestion,
    currentAnswer,
    currentMeta,
    isStreaming,
    history,
    askQuestion,
    clearHistory,
  };
}
