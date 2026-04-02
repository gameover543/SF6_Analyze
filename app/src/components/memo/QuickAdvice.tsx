"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuickAdvice } from "@/hooks/useQuickAdvice";
import { CHAR_JP } from "@/lib/characters";
import { MEMO_TAG_LABELS } from "@/types/memo";
import type { MemoTag, QuickAdviceEntry } from "@/types/memo";
import MemoSheet from "./MemoSheet";

/** 相対時間 */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}日前`;
  return new Date(iso).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

interface QuickAdviceProps {
  onSaveToMemo: (data: {
    opponentSlug: string;
    body: string;
    tags: MemoTag[];
  }) => void;
  recentOpponents: string[];
}

export default function QuickAdvice({ onSaveToMemo, recentOpponents }: QuickAdviceProps) {
  const {
    currentQuestion,
    currentAnswer,
    currentMeta,
    isStreaming,
    history,
    remaining,
    askQuestion,
  } = useQuickAdvice();

  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [memoSheetOpen, setMemoSheetOpen] = useState(false);
  const [memoPreset, setMemoPreset] = useState<{
    character: string | null;
    body: string;
    tags: MemoTag[];
  } | null>(null);

  const handleAsk = () => {
    if (!input.trim() || isStreaming) return;
    askQuestion(input.trim());
    setInput("");
  };

  /** メモに保存（MemoSheetをプリフィルして開く） */
  const handleSaveToMemo = (meta: QuickAdviceEntry["meta"], answer: string) => {
    setMemoPreset({
      character: meta.opponent,
      body: meta.keyPoints || answer.slice(0, 200),
      tags: meta.tags,
    });
    setMemoSheetOpen(true);
  };

  return (
    <div className="mb-6">
      {/* 残回数バッジ */}
      {remaining !== null && (
        <div className="flex items-center justify-end mb-1.5">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              remaining === 0
                ? "bg-red-500/10 text-red-400"
                : remaining <= 5
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "text-theme-subtle"
            }`}
          >
            本日残り {remaining}回
          </span>
        </div>
      )}

      {/* AI質問入力 */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleAsk()}
          placeholder="AIに質問...（例: リュウの大ゴス確反は？）"
          disabled={isStreaming}
          className="flex-1 px-3 py-2.5 rounded-lg bg-theme-panel border border-theme-border text-sm text-theme-text placeholder-theme-subtle focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleAsk}
          disabled={!input.trim() || isStreaming}
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          {isStreaming ? "..." : "聞く"}
        </button>
      </div>

      {/* 現在の回答 */}
      {(currentAnswer || isStreaming) && (
        <div className="rounded-lg border border-theme-border bg-theme-panel p-4 mb-3">
          <p className="text-xs text-theme-subtle mb-2">Q: {currentQuestion}</p>
          <div className="text-sm text-theme-text leading-relaxed">
            {isStreaming && !currentAnswer ? (
              <span className="text-theme-muted animate-pulse">回答中...</span>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentAnswer}
              </ReactMarkdown>
            )}
          </div>
          {/* メモに保存ボタン（ストリーミング完了後のみ） */}
          {!isStreaming && currentMeta && (
            <button
              onClick={() => handleSaveToMemo(currentMeta, currentAnswer)}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition"
            >
              📝 メモに保存
            </button>
          )}
        </div>
      )}

      {/* 質問履歴 */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-theme-subtle hover:text-theme-muted transition mb-2"
          >
            {showHistory ? "▼" : "▶"} 過去の質問 ({history.length}件)
          </button>
          {showHistory && (
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-theme-border bg-theme-panel/60 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-theme-subtle">Q: {entry.question}</p>
                    <span className="text-xs text-theme-subtle">{timeAgo(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-theme-muted line-clamp-2 mb-2">{entry.answer}</p>
                  <button
                    onClick={() => handleSaveToMemo(entry.meta, entry.answer)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                  >
                    📝 メモに保存
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* メモ保存用シート（プリフィル付き） */}
      <MemoSheet
        isOpen={memoSheetOpen}
        onClose={() => setMemoSheetOpen(false)}
        onSave={(data) => {
          onSaveToMemo(data);
          setMemoSheetOpen(false);
        }}
        presetCharacter={memoPreset?.character}
        presetBody={memoPreset?.body}
        presetTags={memoPreset?.tags}
        recentOpponents={recentOpponents}
      />
    </div>
  );
}
