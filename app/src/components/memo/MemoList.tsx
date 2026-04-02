"use client";

import { useState, useMemo } from "react";
import type { Memo } from "@/types/memo";
import { MEMO_TAG_LABELS } from "@/types/memo";
import { CHAR_JP } from "@/lib/characters";

/** 相対時間表示 */
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

interface MemoListProps {
  memos: Memo[];
  characterCounts: Record<string, number>;
  onDelete: (id: string) => void;
  /** 初期フィルタ対象キャラ（URLパラメータ等から） */
  initialCharFilter?: string | null;
}

export default function MemoList({
  memos,
  characterCounts,
  onDelete,
  initialCharFilter,
}: MemoListProps) {
  const [charFilter, setCharFilter] = useState<string | null>(initialCharFilter || null);
  const [search, setSearch] = useState("");

  // キャラタブ（件数降順）
  const charTabs = useMemo(
    () =>
      Object.entries(characterCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([slug, count]) => ({ slug, count })),
    [characterCounts]
  );

  // フィルタ適用
  const filtered = useMemo(() => {
    let result = memos;
    if (charFilter) result = result.filter((m) => m.opponentSlug === charFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.body.toLowerCase().includes(q));
    }
    return result;
  }, [memos, charFilter, search]);

  return (
    <div>
      {/* 検索 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="メモを検索..."
          className="w-full px-3 py-2 rounded-lg bg-theme-panel border border-theme-border text-sm text-theme-text placeholder-theme-subtle focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* キャラタブ */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-4 pb-1">
        <button
          onClick={() => setCharFilter(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
            charFilter === null
              ? "bg-emerald-600 text-white border-emerald-600"
              : "text-theme-muted border-theme-border hover:text-theme-text"
          }`}
        >
          すべて ({memos.length})
        </button>
        {charTabs.map(({ slug, count }) => (
          <button
            key={slug}
            onClick={() => setCharFilter(charFilter === slug ? null : slug)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              charFilter === slug
                ? "bg-emerald-600 text-white border-emerald-600"
                : "text-theme-muted border-theme-border hover:text-theme-text"
            }`}
          >
            {CHAR_JP[slug] || slug} ({count})
          </button>
        ))}
      </div>

      {/* メモカード一覧 */}
      {filtered.length === 0 ? (
        <p className="text-center text-theme-subtle text-sm py-12">
          {memos.length === 0
            ? "まだメモがありません。右下の ＋ ボタンからメモを追加しましょう"
            : "該当するメモがありません"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((memo) => (
            <MemoCard key={memo.id} memo={memo} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/** メモカード1件 */
function MemoCard({ memo, onDelete }: { memo: Memo; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-theme-border bg-theme-panel p-3">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium text-theme-text">
          vs {CHAR_JP[memo.opponentSlug] || memo.opponentSlug}
        </span>
        {memo.result && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              memo.result === "win"
                ? "text-blue-400 bg-blue-500/10"
                : "text-red-400 bg-red-500/10"
            }`}
          >
            {memo.result === "win" ? "勝ち" : "負け"}
          </span>
        )}
        <span className="text-xs text-theme-subtle ml-auto">{timeAgo(memo.createdAt)}</span>
        <button
          onClick={() => onDelete(memo.id)}
          className="text-theme-subtle hover:text-red-400 transition text-xs ml-1"
          aria-label="削除"
        >
          ✕
        </button>
      </div>

      {/* タグ */}
      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {memo.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              {MEMO_TAG_LABELS[tag]}
            </span>
          ))}
        </div>
      )}

      {/* 本文 */}
      <p className="text-sm text-theme-muted leading-relaxed whitespace-pre-wrap">
        {memo.body}
      </p>
    </div>
  );
}
