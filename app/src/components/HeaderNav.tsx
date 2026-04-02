"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadProfile } from "@/lib/profile-storage";
import { CHAR_JP } from "@/lib/characters";
import ThemeProvider from "@/components/ThemeProvider";
import SettingsSheet from "@/components/SettingsSheet";

/** ヘッダーナビゲーション（Client Component） */
export default function HeaderNav() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileLabel, setProfileLabel] = useState<string | null>(null);

  // プロフィールのラベルを読み込み
  const refreshProfile = () => {
    const p = loadProfile();
    if (p?.mainCharacter) {
      const name = CHAR_JP[p.mainCharacter] || p.mainCharacter;
      const ct = p.controlType === "classic" ? "CL" : "MO";
      setProfileLabel(`${name}/${ct}`);
    } else {
      setProfileLabel(null);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <>
      <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4 sm:gap-8">
        <Link href="/" className="text-base sm:text-lg font-bold text-theme-text shrink-0">
          SF6 Coach
        </Link>
        {/* ナビリンク */}
        <div className="flex gap-4 sm:gap-6 text-sm overflow-x-auto scrollbar-none flex-1">
          <Link href="/frames" className="text-theme-muted hover:text-theme-text transition shrink-0">
            フレームデータ
          </Link>
          <Link href="/memos" className="text-theme-muted hover:text-theme-text transition shrink-0">
            メモ
          </Link>
          <Link href="/admin/coverage" className="text-theme-subtle hover:text-theme-muted transition text-xs shrink-0 hidden sm:inline">
            カバレッジ
          </Link>
        </div>

        {/* プロフィール表示 + 設定ボタン */}
        <div className="flex items-center gap-1 shrink-0">
          {profileLabel && (
            <span className="text-xs text-theme-muted hidden sm:inline">{profileLabel}</span>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-theme-muted hover:text-theme-text transition text-sm px-2 py-1 rounded hover:bg-theme-raised"
            aria-label="設定"
          >
            ⚙
          </button>
          <ThemeProvider />
        </div>
      </nav>

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={refreshProfile}
      />
    </>
  );
}
