"use client";

import { useState, useEffect } from "react";
import type { CharacterInfo } from "@/types/frame-data";
import { clearChatHistory } from "@/lib/profile-storage";
import { useSessionState } from "@/hooks/useSessionState";
import { useChatMessages } from "@/hooks/useChatMessages";
import ChatSidebar from "@/components/chat/ChatSidebar";
import MessageList from "@/components/chat/MessageList";
import ChatInputArea from "@/components/chat/ChatInputArea";

interface ChatInterfaceProps {
  characters: CharacterInfo[];
}

export default function ChatInterface({ characters }: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"reset-chat" | "reset-profile" | null>(null);

  const {
    profile,
    mode,
    initialized,
    initialHistory,
    selectedChars,
    charSearch,
    setCharSearch,
    filteredChars,
    toggleChar,
    applyProfile,
    resetProfile,
  } = useSessionState(characters);

  const {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    sendMessage,
    clearMessages,
  } = useChatMessages({
    selectedChars,
    profile,
    mode,
    onProfileExtracted: applyProfile,
  });

  // 初期化完了後、保存済み履歴を一度だけ復元する
  useEffect(() => {
    if (initialized && initialHistory.length > 0) {
      setMessages(initialHistory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const charName = (slug: string) =>
    characters.find((c) => c.slug === slug)?.name || slug;

  // 会話だけクリア（プロフィール維持）
  const handleNewChat = () => {
    clearChatHistory();
    clearMessages();
    setShowConfirm(null);
  };

  // プロフィールごと全リセット
  const handleResetProfile = () => {
    resetProfile();
    clearMessages();
    setShowConfirm(null);
    setSidebarOpen(false);
  };

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
        <ChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          profile={profile}
          mode={mode}
          selectedChars={selectedChars}
          filteredChars={filteredChars}
          charSearch={charSearch}
          onCharSearchChange={setCharSearch}
          onToggleChar={toggleChar}
          onShowConfirm={setShowConfirm}
          charName={charName}
        />

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            mode={mode}
            profile={profile}
            charName={charName}
            onExampleClick={setInput}
          />
          <ChatInputArea
            input={input}
            isLoading={isLoading}
            mode={mode}
            selectedChars={selectedChars}
            charName={charName}
            onInputChange={setInput}
            onSend={sendMessage}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}
