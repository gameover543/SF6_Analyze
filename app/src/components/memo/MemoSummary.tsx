"use client";

import Link from "next/link";
import { useMemos } from "@/hooks/useMemos";
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

interface MemoSummaryProps {
  slug: string;
  /** FAB経由でメモシートを開くコールバック（MemoFabが管理） */
  onAddMemo?: () => void;
}

/** フレームデータページに埋め込む直近メモサマリー */
export default function MemoSummary({ slug, onAddMemo }: MemoSummaryProps) {
  const { memos, initialized } = useMemos();

  if (!initialized) return null;

  // このキャラの直近3件
  const charMemos = memos
    .filter((m) => m.opponentSlug === slug)
    .slice(0, 3);

  const total = memos.filter((m) => m.opponentSlug === slug).length;
  const charName = CHAR_JP[slug] || slug;

  if (total === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-emerald-500 dark:text-emerald-300">
          {charName}戦メモ ({total}件)
        </h2>
        <div className="flex items-center gap-2">
          {total > 3 && (
            <Link
              href={`/memos?char=${slug}`}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              すべて見る →
            </Link>
          )}
        </div>
      </div>

      {/* 直近メモ */}
      <div className="space-y-2">
        {charMemos.map((memo) => (
          <div
            key={memo.id}
            className="rounded border border-theme-border bg-theme-panel/60 p-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
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
              {memo.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                >
                  {MEMO_TAG_LABELS[tag]}
                </span>
              ))}
              <span className="text-xs text-theme-subtle ml-auto">
                {timeAgo(memo.createdAt)}
              </span>
            </div>
            <p className="text-sm text-theme-muted leading-relaxed whitespace-pre-wrap line-clamp-2">
              {memo.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
