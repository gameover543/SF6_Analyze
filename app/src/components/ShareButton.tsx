"use client";

import { useState, useCallback } from "react";

interface ShareButtonProps {
  title: string;
  text: string;
}

/** シェアボタン（Web Share API対応デバイスはネイティブシェア、非対応はURLコピー） */
export default function ShareButton({ title, text }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;

    // Web Share API対応（主にモバイル）
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // ユーザーがキャンセルした場合は何もしない
        return;
      }
    }

    // フォールバック: クリップボードにコピー
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 非対応の場合は無視
    }
  }, [title, text]);

  return (
    <button
      onClick={handleShare}
      className="text-theme-subtle hover:text-theme-text transition text-sm px-2 py-1 rounded hover:bg-theme-raised"
      aria-label="共有"
      title="このページを共有"
    >
      {copied ? "✓ コピー" : "↗ 共有"}
    </button>
  );
}
