"use client";
import { useState, useEffect } from "react";
import type { CharacterInfo } from "@/types/frame-data";
import type { UserProfile } from "@/types/profile";
import {
  loadProfile,
  saveProfile,
  loadChatHistory,
  clearProfile,
  clearChatHistory,
} from "@/lib/profile-storage";
import type { Message } from "./useChatMessages";

/**
 * プロフィール・モード・キャラ選択などのセッション状態を管理するカスタムフック。
 * LocalStorageの初期化もここで行う。
 */
export function useSessionState(characters: CharacterInfo[]) {
  const [profile, setProfileInternal] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<"counseling" | "coaching" | "matchup">("coaching");
  const [initialized, setInitialized] = useState(false);
  const [initialHistory, setInitialHistory] = useState<Message[]>([]);
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [charSearch, setCharSearch] = useState("");
  /** マッチアップモード時の対戦相手キャラslug */
  const [opponentChar, setOpponentChar] = useState<string | null>(null);

  // 初期化：LocalStorageからプロフィールと履歴を読み込む
  useEffect(() => {
    const savedProfile = loadProfile();
    if (savedProfile) {
      setProfileInternal(savedProfile);
      setMode("coaching");
      setSelectedChars([savedProfile.mainCharacter]);
      const savedHistory = loadChatHistory();
      if (savedHistory.length > 0) {
        setInitialHistory(savedHistory);
      }
    } else {
      setMode("counseling");
    }
    setInitialized(true);
  }, []);

  const filteredChars = charSearch
    ? characters.filter(
        (c) =>
          c.name.toLowerCase().includes(charSearch.toLowerCase()) ||
          c.slug.includes(charSearch.toLowerCase())
      )
    : characters;

  const toggleChar = (slug: string) => {
    setSelectedChars((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < 3
          ? [...prev, slug]
          : prev
    );
  };

  /** カウンセリング完了：プロフィールを保存してコーチングモードへ移行 */
  const applyProfile = (p: UserProfile) => {
    saveProfile(p);
    setProfileInternal(p);
    setMode("coaching");
    setSelectedChars([p.mainCharacter]);
  };

  /** プロフィールと履歴を全消去してカウンセリングモードへ戻す */
  const resetProfile = () => {
    clearProfile();
    clearChatHistory();
    setProfileInternal(null);
    setMode("counseling");
    setSelectedChars([]);
    setOpponentChar(null);
  };

  /** マッチアップモードへ移行（対戦相手を指定） */
  const enterMatchupMode = (opponent: string) => {
    setOpponentChar(opponent);
    setMode("matchup");
  };

  /** マッチアップモードを終了してコーチングモードへ戻す */
  const exitMatchupMode = () => {
    setOpponentChar(null);
    setMode("coaching");
  };

  return {
    profile,
    mode,
    initialized,
    initialHistory,
    selectedChars,
    setSelectedChars,
    charSearch,
    setCharSearch,
    filteredChars,
    toggleChar,
    applyProfile,
    resetProfile,
    opponentChar,
    enterMatchupMode,
    exitMatchupMode,
  };
}
