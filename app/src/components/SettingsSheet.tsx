"use client";

import { useState, useEffect } from "react";
import { CHARACTER_LIST } from "@/lib/frame-data";
import { CHAR_JP } from "@/lib/characters";
import { loadProfile, saveProfile } from "@/lib/profile-storage";
import type { UserProfile } from "@/types/profile";

const RANKS = ["ルーキー", "アイアン", "ブロンズ", "シルバー", "ゴールド", "プラチナ", "ダイヤ", "マスター"];

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** ひらがな→カタカナ変換 */
function toKatakana(s: string): string {
  return s.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

export default function SettingsSheet({ isOpen, onClose, onSaved }: SettingsSheetProps) {
  const [mainChar, setMainChar] = useState("");
  const [controlType, setControlType] = useState<"classic" | "modern">("classic");
  const [rank, setRank] = useState("マスター");
  const [charSearch, setCharSearch] = useState("");

  // 既存プロフィールから初期値をロード
  useEffect(() => {
    if (isOpen) {
      const p = loadProfile();
      if (p) {
        setMainChar(p.mainCharacter || "");
        setControlType(p.controlType || "classic");
        setRank(p.rank || "マスター");
      }
      setCharSearch("");
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!mainChar) return;
    const existing = loadProfile();
    const updated: UserProfile = {
      mainCharacter: mainChar,
      subCharacters: existing?.subCharacters || [],
      controlType,
      rank,
      masterRating: existing?.masterRating,
      weakAgainst: existing?.weakAgainst || [],
      challenges: existing?.challenges || [],
      currentFocus: existing?.currentFocus,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveProfile(updated);
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  // キャラ検索
  const searchLower = charSearch.toLowerCase();
  const searchKata = toKatakana(charSearch);
  const filteredChars = charSearch
    ? CHARACTER_LIST.filter((c) => {
        const jp = CHAR_JP[c.slug] || "";
        return c.slug.includes(searchLower) || c.name.toLowerCase().includes(searchLower) || jp.includes(charSearch) || jp.includes(searchKata);
      })
    : CHARACTER_LIST;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-theme-page border-t border-theme-border rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up md:left-auto md:top-0 md:bottom-0 md:w-[360px] md:rounded-t-none md:rounded-l-2xl md:max-h-full">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border sticky top-0 bg-theme-page z-10">
          <h2 className="text-base font-semibold text-theme-text">設定</h2>
          <button onClick={onClose} className="text-theme-subtle hover:text-theme-text transition text-xl leading-none px-1">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* メインキャラ */}
          <div>
            <p className="text-xs text-theme-subtle mb-2">
              メインキャラ
              {mainChar && <span className="ml-2 text-emerald-400 font-medium">{CHAR_JP[mainChar] || mainChar}</span>}
            </p>
            <input
              type="text"
              value={charSearch}
              onChange={(e) => setCharSearch(e.target.value)}
              placeholder="キャラ名で検索..."
              className="w-full px-3 py-2 rounded-lg bg-theme-panel border border-theme-border text-sm text-theme-text placeholder-theme-subtle focus:outline-none focus:border-emerald-500 mb-2"
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredChars.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => { setMainChar(c.slug); setCharSearch(""); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    mainChar === c.slug
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-transparent text-theme-muted border-theme-border hover:text-theme-text"
                  }`}
                >
                  {CHAR_JP[c.slug] || c.name}
                </button>
              ))}
            </div>
          </div>

          {/* 操作タイプ */}
          <div>
            <p className="text-xs text-theme-subtle mb-2">操作タイプ</p>
            <div className="flex gap-2">
              {(["classic", "modern"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setControlType(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition border ${
                    controlType === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-theme-muted border-theme-border hover:text-theme-text"
                  }`}
                >
                  {t === "classic" ? "Classic" : "Modern"}
                </button>
              ))}
            </div>
          </div>

          {/* ランク帯 */}
          <div>
            <p className="text-xs text-theme-subtle mb-2">ランク帯</p>
            <div className="flex flex-wrap gap-1.5">
              {RANKS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRank(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    rank === r
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-theme-muted border-theme-border hover:text-theme-text"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 保存 */}
          <button
            onClick={handleSave}
            disabled={!mainChar}
            className="w-full py-3 rounded-lg text-sm font-semibold transition bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
}
