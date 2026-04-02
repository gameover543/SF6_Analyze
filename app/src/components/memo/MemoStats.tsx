"use client";

import { useMemo } from "react";
import type { Memo } from "@/types/memo";
import { MEMO_TAG_LABELS } from "@/types/memo";
import { CHAR_JP } from "@/lib/characters";

interface MemoStatsProps {
  memos: Memo[];
}

/** メモの統計・振り返りセクション */
export default function MemoStats({ memos }: MemoStatsProps) {
  const stats = useMemo(() => {
    if (memos.length === 0) return null;

    // 勝敗集計
    const wins = memos.filter((m) => m.result === "win").length;
    const losses = memos.filter((m) => m.result === "lose").length;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

    // キャラ別勝敗
    const charStats: Record<string, { wins: number; losses: number }> = {};
    for (const m of memos) {
      if (!m.result) continue;
      if (!charStats[m.opponentSlug]) charStats[m.opponentSlug] = { wins: 0, losses: 0 };
      if (m.result === "win") charStats[m.opponentSlug].wins++;
      else charStats[m.opponentSlug].losses++;
    }

    // 苦手キャラ（負けが多い順、3戦以上）
    const weakAgainst = Object.entries(charStats)
      .filter(([, s]) => s.wins + s.losses >= 3)
      .sort((a, b) => {
        const rateA = a[1].wins / (a[1].wins + a[1].losses);
        const rateB = b[1].wins / (b[1].wins + b[1].losses);
        return rateA - rateB;
      })
      .slice(0, 3);

    // 頻出タグ
    const tagCounts: Record<string, number> = {};
    for (const m of memos) {
      for (const tag of m.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { wins, losses, winRate, weakAgainst, topTags, totalMemos: memos.length };
  }, [memos]);

  if (!stats || stats.totalMemos < 3) return null;

  return (
    <details className="mb-6 group">
      <summary className="text-xs text-theme-subtle hover:text-theme-muted transition cursor-pointer mb-2">
        ▶ 統計 ({stats.totalMemos}件のメモ)
      </summary>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
        {/* 勝敗 */}
        {stats.winRate !== null && (
          <StatCard
            label="勝率"
            value={`${stats.winRate}%`}
            sub={`${stats.wins}勝 ${stats.losses}敗`}
            color={stats.winRate >= 50 ? "text-blue-400" : "text-red-400"}
          />
        )}

        {/* メモ総数 */}
        <StatCard label="メモ数" value={String(stats.totalMemos)} sub="件" />

        {/* 頻出課題 */}
        {stats.topTags.length > 0 && (
          <div className="rounded-lg border border-theme-border bg-theme-panel p-3">
            <p className="text-xs text-theme-subtle mb-1">よくメモする場面</p>
            <div className="flex flex-wrap gap-1">
              {stats.topTags.map(([tag, count]) => (
                <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                  {MEMO_TAG_LABELS[tag as keyof typeof MEMO_TAG_LABELS] || tag} ({count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 苦手キャラ */}
        {stats.weakAgainst.length > 0 && (
          <div className="rounded-lg border border-theme-border bg-theme-panel p-3">
            <p className="text-xs text-theme-subtle mb-1">苦手キャラ</p>
            <div className="space-y-0.5">
              {stats.weakAgainst.map(([slug, s]) => {
                const rate = Math.round((s.wins / (s.wins + s.losses)) * 100);
                return (
                  <div key={slug} className="flex items-center justify-between text-xs">
                    <span className="text-theme-text">{CHAR_JP[slug] || slug}</span>
                    <span className="text-red-400">{rate}% ({s.wins}勝{s.losses}敗)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "text-theme-text",
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-theme-border bg-theme-panel p-3 text-center">
      <p className="text-xs text-theme-subtle mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-theme-subtle">{sub}</p>
    </div>
  );
}
