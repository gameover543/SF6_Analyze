"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Memo, MemoTag } from "@/types/memo";
import { loadMemos, saveMemos } from "@/lib/memo-storage";
import { getOrCreateSessionId } from "@/lib/profile-storage";

/** メモのCRUD・フィルタ・サーバー同期を管理するHook */
export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [initialized, setInitialized] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初期ロード（localStorage → サーバーフォールバック）
  useEffect(() => {
    const local = loadMemos();
    if (local.length > 0) {
      setMemos(local);
      setInitialized(true);
    }

    // サーバーからも取得して、件数が多い方を採用
    const sessionId = getOrCreateSessionId();
    fetch(`/api/memos?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.memos?.length > local.length) {
          setMemos(data.memos);
          saveMemos(data.memos);
        }
      })
      .catch(() => {})
      .finally(() => setInitialized(true));
  }, []);

  // サーバーへの非同期保存（500msデバウンス）
  const syncToServer = useCallback((updated: Memo[]) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const sessionId = getOrCreateSessionId();
      fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, memos: updated }),
      }).catch(() => {});
    }, 500);
  }, []);

  // メモ追加
  const addMemo = useCallback(
    (draft: Omit<Memo, "id" | "createdAt">) => {
      const memo: Memo = {
        ...draft,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setMemos((prev) => {
        const updated = [memo, ...prev].slice(0, 500);
        saveMemos(updated);
        syncToServer(updated);
        return updated;
      });
    },
    [syncToServer]
  );

  // メモ削除
  const deleteMemo = useCallback(
    (id: string) => {
      setMemos((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveMemos(updated);
        syncToServer(updated);
        return updated;
      });
    },
    [syncToServer]
  );

  // 最近の対戦相手（直近5キャラ、重複排除）
  const recentOpponents = memos
    .reduce<string[]>((acc, m) => {
      if (!acc.includes(m.opponentSlug)) acc.push(m.opponentSlug);
      return acc;
    }, [])
    .slice(0, 5);

  // メモがあるキャラ一覧（件数付き、件数降順）
  const characterCounts = memos.reduce<Record<string, number>>((acc, m) => {
    acc[m.opponentSlug] = (acc[m.opponentSlug] || 0) + 1;
    return acc;
  }, {});

  // フィルタ関数
  const filterByCharacter = useCallback(
    (slug: string) => memos.filter((m) => m.opponentSlug === slug),
    [memos]
  );

  const filterByTag = useCallback(
    (tag: MemoTag) => memos.filter((m) => m.tags.includes(tag)),
    [memos]
  );

  const searchMemos = useCallback(
    (query: string) => {
      const q = query.toLowerCase();
      return memos.filter((m) => m.body.toLowerCase().includes(q));
    },
    [memos]
  );

  return {
    memos,
    initialized,
    addMemo,
    deleteMemo,
    recentOpponents,
    characterCounts,
    filterByCharacter,
    filterByTag,
    searchMemos,
  };
}
