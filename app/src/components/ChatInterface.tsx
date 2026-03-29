"use client";

import { useState, useRef, useEffect } from "react";
import type { CharacterInfo } from "@/types/frame-data";
import type { UserProfile } from "@/types/profile";
import {
  loadProfile,
  saveProfile,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  clearProfile,
} from "@/lib/profile-storage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  characters: CharacterInfo[];
}

/** AIの回答からプロフィールJSONを抽出する */
function extractProfileFromReply(reply: string): UserProfile | null {
  const match = reply.match(/```json:profile\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    return {
      mainCharacter: data.mainCharacter || "",
      subCharacters: data.subCharacters || [],
      controlType: data.controlType || "classic",
      rank: data.rank || "",
      masterRating: data.masterRating || undefined,
      weakAgainst: data.weakAgainst || [],
      challenges: data.challenges || [],
      currentFocus: data.currentFocus || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** プロフィールJSON部分を除去して表示用テキストにする */
function cleanReplyForDisplay(reply: string): string {
  return reply.replace(/```json:profile\s*\n[\s\S]*?\n```/, "").trim();
}

export default function ChatInterface({ characters }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [charSearch, setCharSearch] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<"counseling" | "coaching">("coaching");
  const [initialized, setInitialized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"reset-chat" | "reset-profile" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期化：プロフィールと履歴を読み込む
  useEffect(() => {
    const savedProfile = loadProfile();
    const savedHistory = loadChatHistory();

    if (savedProfile) {
      setProfile(savedProfile);
      setMode("coaching");
      setSelectedChars([savedProfile.mainCharacter]);
      if (savedHistory.length > 0) {
        setMessages(savedHistory);
      }
    } else {
      setMode("counseling");
    }
    setInitialized(true);
  }, []);

  // メッセージが追加されたら自動スクロール＆履歴保存
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > 0 && mode === "coaching") {
      saveChatHistory(messages);
    }
  }, [messages, mode]);

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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          characterSlugs: selectedChars,
          profile,
          mode,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `エラー: ${data.error}` },
        ]);
      } else {
        // カウンセリングモード：プロフィールJSONの抽出を試みる
        if (mode === "counseling") {
          const extractedProfile = extractProfileFromReply(data.reply);
          if (extractedProfile) {
            saveProfile(extractedProfile);
            setProfile(extractedProfile);
            setMode("coaching");
            setSelectedChars([extractedProfile.mainCharacter]);
            const cleanReply = cleanReplyForDisplay(data.reply);
            setMessages([
              ...newMessages,
              { role: "assistant", content: cleanReply },
            ]);
            return;
          }
        }

        setMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "通信エラーが発生しました。もう一度お試しください。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 会話だけクリア（プロフィール維持）
  const handleNewChat = () => {
    clearChatHistory();
    setMessages([]);
    setShowConfirm(null);
  };

  // プロフィールごと全リセット
  const handleResetProfile = () => {
    clearProfile();
    clearChatHistory();
    setProfile(null);
    setMessages([]);
    setMode("counseling");
    setSelectedChars([]);
    setShowConfirm(null);
    setSidebarOpen(false);
  };

  const charName = (slug: string) =>
    characters.find((c) => c.slug === slug)?.name || slug;

  if (!initialized) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* ツールバー */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950/80">
        {/* モバイル: サイドバー開閉 */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          aria-label="メニュー"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        {/* モード表示 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {mode === "counseling" ? (
            <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
              ヒアリング中
            </span>
          ) : (
            <>
              {profile && (
                <span className="text-xs text-gray-400 truncate">
                  {charName(profile.mainCharacter)} / {profile.rank}
                  {profile.masterRating ? ` (MR${profile.masterRating})` : ""}
                </span>
              )}
              {selectedChars.length > 0 && (
                <div className="hidden sm:flex gap-1">
                  {selectedChars.map((slug) => (
                    <span
                      key={slug}
                      className="text-xs bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded"
                    >
                      {charName(slug)}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* アクションボタン */}
        {mode === "coaching" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfirm("reset-chat")}
              className="text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition"
              title="新しい会話を始める"
            >
              新しい会話
            </button>
            <button
              onClick={() => setShowConfirm("reset-profile")}
              className="text-xs text-gray-500 hover:text-orange-400 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition"
              title="プロフィールを変更する"
            >
              プロフィール変更
            </button>
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
          <span className="text-sm text-gray-300 flex-1">
            {showConfirm === "reset-chat"
              ? "会話履歴をクリアしますか？（プロフィールは維持されます）"
              : "プロフィールをリセットして、ヒアリングからやり直しますか？"}
          </span>
          <button
            onClick={showConfirm === "reset-chat" ? handleNewChat : handleResetProfile}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
              showConfirm === "reset-chat"
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-orange-600 hover:bg-orange-500 text-white"
            }`}
          >
            {showConfirm === "reset-chat" ? "クリア" : "リセット"}
          </button>
          <button
            onClick={() => setShowConfirm(null)}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            キャンセル
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* モバイルオーバーレイ */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* サイドバー */}
        <div
          className={`
            fixed md:relative z-40 top-0 left-0 h-full w-64
            border-r border-gray-800 bg-gray-950 p-4 overflow-y-auto
            flex flex-col transition-transform duration-200
            md:translate-x-0 md:w-56
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* モバイル: 閉じるボタン */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute top-3 right-3 p-1 text-gray-500 hover:text-white"
            aria-label="閉じる"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>

          {/* プロフィール表示 */}
          {profile && (
            <div className="mb-4 p-3 rounded-lg bg-gray-900 border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">担当プレイヤー</div>
              <div className="text-sm font-medium text-white">
                {charName(profile.mainCharacter)}
              </div>
              <div className="text-xs text-gray-400">
                {profile.controlType} / {profile.rank}
                {profile.masterRating ? ` (MR${profile.masterRating})` : ""}
              </div>
              {profile.weakAgainst.length > 0 && (
                <div className="mt-1.5 text-xs text-gray-500">
                  苦手: {profile.weakAgainst.map(charName).join(", ")}
                </div>
              )}
              {profile.challenges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {profile.challenges.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-orange-900/30 text-orange-400 px-1.5 py-0.5 rounded"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* キャラ選択（コーチングモード時のみ） */}
          {mode === "coaching" && (
            <>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                参照キャラ（最大3）
              </h3>
              <input
                type="text"
                placeholder="キャラ検索..."
                value={charSearch}
                onChange={(e) => setCharSearch(e.target.value)}
                className="w-full px-2 py-1.5 mb-3 rounded bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
                {filteredChars.map((char) => {
                  const isSelected = selectedChars.includes(char.slug);
                  const isMain = char.slug === profile?.mainCharacter;
                  return (
                    <button
                      key={char.slug}
                      onClick={() => toggleChar(char.slug)}
                      className={`text-left px-2 py-1.5 rounded text-xs transition ${
                        isSelected
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "text-gray-400 hover:text-white hover:bg-gray-900"
                      }`}
                    >
                      {char.name}
                      {isMain && (
                        <span className="ml-1 text-gray-600">MAIN</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* サイドバー下部のアクション */}
          <div className="mt-4 pt-3 border-t border-gray-800 flex flex-col gap-2">
            {mode === "coaching" && (
              <button
                onClick={() => { setShowConfirm("reset-chat"); setSidebarOpen(false); }}
                className="text-xs text-gray-500 hover:text-white text-left transition"
              >
                新しい会話を始める
              </button>
            )}
            <button
              onClick={() => { setShowConfirm("reset-profile"); setSidebarOpen(false); }}
              className="text-xs text-gray-600 hover:text-orange-400 text-left transition"
            >
              プロフィール変更
            </button>
          </div>
        </div>

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* メッセージ一覧 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-20">
                {mode === "counseling" ? (
                  <>
                    <p className="text-lg mb-2">はじめまして</p>
                    <p className="text-sm mb-6">
                      あなた専属のAIコーチです。
                      <br />
                      まずはヒアリングをさせてください。
                    </p>
                    <button
                      onClick={() => setInput("よろしくお願いします")}
                      className="text-sm text-blue-400 hover:text-blue-300 px-4 py-2 border border-blue-500/30 rounded-lg hover:border-blue-400/50 transition"
                    >
                      コーチングを始める
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg mb-2">SF6 AIコーチ</p>
                    <p className="text-sm">
                      何でも質問してください。プロフィールとプロ選手の知識に基づいてアドバイスします。
                    </p>
                    <div className="mt-6 flex flex-col gap-2 items-center">
                      {[
                        `${charName(profile?.mainCharacter || "")}の確反に使える技は？`,
                        profile?.weakAgainst?.[0]
                          ? `${charName(profile.weakAgainst[0])}戦のコツは？`
                          : "苦手キャラへの対策は？",
                        "今の課題を克服する練習メニューを教えて",
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => setInput(example)}
                          className="text-xs text-gray-500 hover:text-white px-3 py-1.5 border border-gray-800 rounded-lg hover:border-gray-600 transition"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-100"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-4 py-3 rounded-2xl text-sm text-gray-400">
                  考え中...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div className="border-t border-gray-800 p-4">
            {/* モバイル: 選択キャラ表示 */}
            {selectedChars.length > 0 && mode === "coaching" && (
              <div className="flex gap-2 mb-2 sm:hidden">
                {selectedChars.map((slug) => (
                  <span
                    key={slug}
                    className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded"
                  >
                    {charName(slug)}
                  </span>
                ))}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-xs text-gray-600 hover:text-gray-400"
                >
                  変更
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && sendMessage()
                }
                placeholder={
                  mode === "counseling"
                    ? "コーチに話しかけてください..."
                    : "質問を入力..."
                }
                className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
