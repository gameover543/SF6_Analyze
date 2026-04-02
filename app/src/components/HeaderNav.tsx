"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadProfile } from "@/lib/profile-storage";
import { CHAR_JP } from "@/lib/characters";
import ThemeProvider from "@/components/ThemeProvider";
import SettingsSheet from "@/components/SettingsSheet";

/** ナビリンクの定義 */
const NAV_LINKS = [
  { href: "/frames", label: "フレームデータ" },
  { href: "/memos", label: "メモ" },
] as const;

/** ヘッダーナビゲーション（Client Component） */
export default function HeaderNav() {
  const pathname = usePathname();
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

  /** 現在のパスがリンク先と一致するか（前方一致） */
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4 sm:gap-8">
        <Link href="/" className="text-base sm:text-lg font-bold text-theme-text shrink-0">
          SF6 Coach
        </Link>
        {/* ナビリンク（アクティブ表示付き） */}
        <div className="flex gap-4 sm:gap-6 text-sm overflow-x-auto scrollbar-none flex-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 transition ${
                isActive(href)
                  ? "text-theme-text font-medium"
                  : "text-theme-muted hover:text-theme-text"
              }`}
            >
              {label}
            </Link>
          ))}
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
