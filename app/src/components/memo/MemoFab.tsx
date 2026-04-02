"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useMemos } from "@/hooks/useMemos";
import MemoSheet from "./MemoSheet";

/** 全ページに常駐するFAB（フローティングアクションボタン）+ボトムシート */
export default function MemoFab() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { addMemo, recentOpponents } = useMemos();

  // /frames/[slug] ページならキャラを自動選択
  const match = pathname.match(/^\/frames\/([a-z]+)$/);
  const presetCharacter = match ? match[1] : null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition flex items-center justify-center text-2xl md:w-12 md:h-12 md:text-xl"
        aria-label="メモを追加"
      >
        +
      </button>

      {/* ボトムシート */}
      <MemoSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={addMemo}
        presetCharacter={presetCharacter}
        recentOpponents={recentOpponents}
      />
    </>
  );
}
