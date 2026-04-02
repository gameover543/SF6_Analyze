"use client";

import { useState, useRef, useEffect } from "react";
import { CHARACTER_LIST } from "@/lib/frame-data";
import { CHAR_JP } from "@/lib/characters";
import type { MemoTag } from "@/types/memo";
import { ALL_MEMO_TAGS, MEMO_TAG_LABELS } from "@/types/memo";

interface MemoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    opponentSlug: string;
    body: string;
    tags: MemoTag[];
    result?: "win" | "lose";
  }) => void;
  /** 事前選択するキャラslug（フレームページから開いた場合） */
  presetCharacter?: string | null;
  /** 最近の対戦相手（先頭に表示） */
  recentOpponents?: string[];
}

export default function MemoSheet({
  isOpen,
  onClose,
  onSave,
  presetCharacter,
  recentOpponents = [],
}: MemoSheetProps) {
  const [selectedChar, setSelectedChar] = useState<string>("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<MemoTag[]>([]);
  const [result, setResult] = useState<"win" | "lose" | undefined>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // シートが開いたときにリセットしてフォーカス
  useEffect(() => {
    if (isOpen) {
      setSelectedChar(presetCharacter || "");
      setBody("");
      setTags([]);
      setResult(undefined);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, presetCharacter]);

  const toggleTag = (tag: MemoTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (!selectedChar || !body.trim()) return;
    onSave({
      opponentSlug: selectedChar,
      body: body.trim(),
      tags,
      result,
    });
    onClose();
  };

  if (!isOpen) return null;

  // キャラリスト: 最近の対戦相手を先頭に
  const recentSet = new Set(recentOpponents);
  const sortedChars = [
    ...CHARACTER_LIST.filter((c) => recentSet.has(c.slug)),
    ...CHARACTER_LIST.filter((c) => !recentSet.has(c.slug)),
  ];

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* シート本体 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-theme-page border-t border-theme-border rounded-t-2xl max-h-[75vh] overflow-y-auto animate-slide-up md:left-auto md:top-0 md:bottom-0 md:w-[400px] md:rounded-t-none md:rounded-l-2xl md:max-h-full">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border sticky top-0 bg-theme-page z-10">
          <h2 className="text-base font-semibold text-theme-text">メモを追加</h2>
          <button
            onClick={onClose}
            className="text-theme-subtle hover:text-theme-text transition text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* キャラ選択 */}
          <div>
            <p className="text-xs text-theme-subtle mb-2">対戦相手</p>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {sortedChars.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setSelectedChar(c.slug)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    selectedChar === c.slug
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-transparent text-theme-muted border-theme-border hover:border-theme-raised hover:text-theme-text"
                  }`}
                >
                  {CHAR_JP[c.slug] || c.name}
                </button>
              ))}
            </div>
          </div>

          {/* タグ */}
          <div>
            <p className="text-xs text-theme-subtle mb-2">タグ</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MEMO_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                    tags.includes(tag)
                      ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                      : "bg-transparent text-theme-muted border-theme-border hover:text-theme-text"
                  }`}
                >
                  {MEMO_TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          {/* 勝敗 */}
          <div>
            <p className="text-xs text-theme-subtle mb-2">勝敗</p>
            <div className="flex gap-2">
              <button
                onClick={() => setResult(result === "win" ? undefined : "win")}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition border ${
                  result === "win"
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                    : "text-theme-muted border-theme-border hover:text-theme-text"
                }`}
              >
                勝ち
              </button>
              <button
                onClick={() => setResult(result === "lose" ? undefined : "lose")}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition border ${
                  result === "lose"
                    ? "bg-red-600/20 text-red-400 border-red-500/40"
                    : "text-theme-muted border-theme-border hover:text-theme-text"
                }`}
              >
                負け
              </button>
            </div>
          </div>

          {/* メモ入力 */}
          <div>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 300))}
              placeholder="メモを入力..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-theme-panel border border-theme-border text-sm text-theme-text placeholder-theme-subtle focus:outline-none focus:border-emerald-500 resize-none"
            />
            <p className="text-xs text-theme-subtle text-right mt-1">
              {body.length}/300
            </p>
          </div>

          {/* 保存 */}
          <button
            onClick={handleSave}
            disabled={!selectedChar || !body.trim()}
            className="w-full py-3 rounded-lg text-sm font-semibold transition bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
}
