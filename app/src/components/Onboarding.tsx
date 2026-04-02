"use client";

import { useState, useEffect } from "react";
import { CHARACTER_LIST } from "@/lib/frame-data";
import { CHAR_JP } from "@/lib/characters";
import { loadProfile, saveProfile } from "@/lib/profile-storage";
import type { UserProfile } from "@/types/profile";

const STORAGE_KEY = "sf6coach_onboarded";
const RANKS = ["ルーキー", "アイアン", "ブロンズ", "シルバー", "ゴールド", "プラチナ", "ダイヤ", "マスター"];

/** ひらがな→カタカナ変換 */
function toKatakana(s: string): string {
  return s.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/** 初回訪問時のオンボーディングウィザード */
export default function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [mainChar, setMainChar] = useState("");
  const [controlType, setControlType] = useState<"classic" | "modern">("classic");
  const [rank, setRank] = useState("ゴールド");
  const [charSearch, setCharSearch] = useState("");

  useEffect(() => {
    // 既にオンボーディング済み or プロフィール設定済みなら表示しない
    const onboarded = localStorage.getItem(STORAGE_KEY);
    const profile = loadProfile();
    if (!onboarded && !profile?.mainCharacter) {
      setShow(true);
    }
  }, []);

  const handleComplete = () => {
    if (mainChar) {
      const profile: UserProfile = {
        mainCharacter: mainChar,
        subCharacters: [],
        controlType,
        rank,
        weakAgainst: [],
        challenges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveProfile(profile);
    }
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

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
      <div className="fixed inset-0 bg-black/60 z-[90]" />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="bg-theme-page border border-theme-border rounded-2xl w-full max-w-md p-6 animate-fade-in">
          {step === 0 && (
            <>
              <h2 className="text-xl font-bold mb-2">SF6 Coach へようこそ</h2>
              <p className="text-theme-muted text-sm mb-6 leading-relaxed">
                フレームデータ検索とAI対戦メモで、あなたの対戦力を上げましょう。
                まずはメインキャラを教えてください。
              </p>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-lg bg-theme-accent-blue text-theme-page text-sm font-semibold hover:opacity-90 transition"
              >
                はじめる
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-2 mt-2 text-xs text-theme-subtle hover:text-theme-muted transition"
              >
                あとで設定する
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs text-theme-subtle mb-1">1/3</p>
              <h2 className="text-lg font-bold mb-4">メインキャラは？</h2>
              <input
                type="text"
                value={charSearch}
                onChange={(e) => setCharSearch(e.target.value)}
                placeholder="キャラ名で検索..."
                className="w-full px-3 py-2 rounded-lg bg-theme-panel border border-theme-border text-sm text-theme-text placeholder-theme-subtle focus:outline-none focus:border-blue-500 mb-3"
              />
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto mb-4">
                {filteredChars.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => { setMainChar(c.slug); setCharSearch(""); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                      mainChar === c.slug
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "text-theme-muted border-theme-border hover:text-theme-text"
                    }`}
                  >
                    {CHAR_JP[c.slug] || c.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!mainChar}
                className="w-full py-3 rounded-lg bg-theme-accent-blue text-theme-page text-sm font-semibold hover:opacity-90 transition disabled:opacity-30"
              >
                次へ
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-theme-subtle mb-1">2/3</p>
              <h2 className="text-lg font-bold mb-4">操作タイプは？</h2>
              <div className="flex gap-3 mb-6">
                {(["classic", "modern"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setControlType(t)}
                    className={`flex-1 py-4 rounded-xl text-sm font-semibold transition border ${
                      controlType === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "text-theme-muted border-theme-border hover:text-theme-text"
                    }`}
                  >
                    {t === "classic" ? "Classic" : "Modern"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-lg bg-theme-accent-blue text-theme-page text-sm font-semibold hover:opacity-90 transition"
              >
                次へ
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-theme-subtle mb-1">3/3</p>
              <h2 className="text-lg font-bold mb-4">ランク帯は？</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {RANKS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRank(r)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition border ${
                      rank === r
                        ? "bg-blue-600 text-white border-blue-600"
                        : "text-theme-muted border-theme-border hover:text-theme-text"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                onClick={handleComplete}
                className="w-full py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition"
              >
                完了！はじめよう
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
