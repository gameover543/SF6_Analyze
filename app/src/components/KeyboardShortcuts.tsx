"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/** グローバルキーボードショートカット */
export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // input/textareaにフォーカス中は無視
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const mod = e.metaKey || e.ctrlKey;

      // ? — ショートカットヘルプ
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // Cmd/Ctrl+K — フレームデータ検索へ
      if (mod && e.key === "k") {
        e.preventDefault();
        router.push("/frames");
        return;
      }

      // Cmd/Ctrl+M — メモページへ
      if (mod && e.key === "m") {
        e.preventDefault();
        router.push("/memos");
        return;
      }

      // Escape — ヘルプを閉じる
      if (e.key === "Escape" && showHelp) {
        setShowHelp(false);
        return;
      }
    },
    [router, showHelp]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!showHelp) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[80]" onClick={() => setShowHelp(false)} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] bg-theme-page border border-theme-border rounded-xl p-6 w-80 animate-fade-in">
        <h2 className="text-base font-semibold mb-4">キーボードショートカット</h2>
        <div className="space-y-2 text-sm">
          <ShortcutRow keys="?" description="このヘルプを表示" />
          <ShortcutRow keys="⌘ K" description="フレームデータへ" />
          <ShortcutRow keys="⌘ M" description="メモへ" />
          <ShortcutRow keys="Esc" description="パネルを閉じる" />
        </div>
        <p className="text-xs text-theme-subtle mt-4">
          ⌘ は Mac の Command / Windows の Ctrl
        </p>
      </div>
    </>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-theme-muted">{description}</span>
      <kbd className="px-2 py-0.5 rounded bg-theme-raised border border-theme-border text-xs font-mono">
        {keys}
      </kbd>
    </div>
  );
}
