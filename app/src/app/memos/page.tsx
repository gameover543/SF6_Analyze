"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useMemos } from "@/hooks/useMemos";
import MemoList from "@/components/memo/MemoList";
import QuickAdvice from "@/components/memo/QuickAdvice";

function MemosContent() {
  const searchParams = useSearchParams();
  const charParam = searchParams.get("char");
  const { memos, characterCounts, deleteMemo, addMemo, recentOpponents, initialized } = useMemos();

  if (!initialized) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-theme-text">対戦メモ</h1>

      {/* AIクイックアドバイス */}
      <QuickAdvice onSaveToMemo={addMemo} recentOpponents={recentOpponents} />

      {/* メモ一覧 */}
      <MemoList
        memos={memos}
        characterCounts={characterCounts}
        onDelete={deleteMemo}
        initialCharFilter={charParam}
      />
    </div>
  );
}

export default function MemosPage() {
  return (
    <Suspense>
      <MemosContent />
    </Suspense>
  );
}
