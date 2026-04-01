"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CharacterInfo } from "@/types/frame-data";
import { clearChatHistory, getSessionId } from "@/lib/profile-storage";
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
  /** 前回セッションの要約テキスト（null=非表示） */
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  /** 要約生成中フラグ */
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

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
    opponentChar,
    enterMatchupMode,
    exitMatchupMode,
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
    opponentChar,
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
    // 要約生成のために現在のメッセージをコピーしておく
    const prevMessages = [...messages];

    clearChatHistory();
    clearMessages();
    setShowConfirm(null);
    // 前回の要約バナーをいったん非表示にする
    setSessionSummary(null);

    // サーバー側の履歴も削除（空配列をPOSTすることでファイルを削除）
    const sessionId = getSessionId();
    if (sessionId) {
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: [] }),
      }).catch(() => {});
    }

    // コーチング/マッチアップモードでユーザー発言が2回以上あれば要約を生成する
    const userTurns = prevMessages.filter((m) => m.role === "user").length;
    if ((mode === "coaching" || mode === "matchup") && userTurns >= 2) {
      setIsSummaryLoading(true);
      fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: prevMessages }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.summary) {
            setSessionSummary(data.summary);
          }
        })
        .catch(() => {
          // 要約生成に失敗してもサイレントに無視（メイン機能に影響させない）
        })
        .finally(() => setIsSummaryLoading(false));
    }
  };

  // プロフィールごと全リセット
  const handleResetProfile = () => {
    resetProfile();
    clearMessages();
    setShowConfirm(null);
    setSidebarOpen(false);
  };

  // マッチアップモードへ移行（会話をクリアして新鮮なコンテキストで開始）
  const handleEnterMatchup = (opponent: string) => {
    enterMatchupMode(opponent);
    clearMessages();
  };

  // マッチアップモードを終了してコーチングへ戻す
  const handleExitMatchup = () => {
    exitMatchupMode();
    clearMessages();
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
          ) : mode === "matchup" && opponentChar ? (
            <>
              <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                マッチアップ分析
              </span>
              <span className="text-xs text-gray-300 truncate">
                {charName(profile?.mainCharacter || "")} vs {charName(opponentChar)}
              </span>
            </>
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

        {/* アクションボタン: スマホでは「…」メニュー代わりにアイコンのみ表示 */}
        {(mode === "coaching" || mode === "matchup") && (
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {mode === "matchup" && (
              <button
                onClick={handleExitMatchup}
                className="text-xs text-purple-400 hover:text-white px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition"
                title="通常コーチングに戻る"
              >
                {/* スマホ: 短縮表示 */}
                <span className="sm:hidden">戻る</span>
                <span className="hidden sm:inline">通常モードへ</span>
              </button>
            )}
            <button
              onClick={() => setShowConfirm("reset-chat")}
              className="text-xs text-gray-500 hover:text-white px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition"
              title="新しい会話を始める"
            >
              <span className="sm:hidden">新規</span>
              <span className="hidden sm:inline">新しい会話</span>
            </button>
            <button
              onClick={() => setShowConfirm("reset-profile")}
              className="text-xs text-gray-500 hover:text-orange-400 px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition"
              title="プロフィールを変更する"
            >
              <span className="sm:hidden">設定</span>
              <span className="hidden sm:inline">プロフィール変更</span>
            </button>
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-sm text-gray-300 flex-1">
            {showConfirm === "reset-chat"
              ? "会話履歴をクリアしますか？（プロフィールは維持されます）"
              : "プロフィールをリセットして、ヒアリングからやり直しますか？"}
          </span>
          <div className="flex items-center gap-2">
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
          opponentChar={opponentChar}
          onEnterMatchup={handleEnterMatchup}
          onExitMatchup={handleExitMatchup}
        />

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 前回セッションの要約バナー */}
          {(isSummaryLoading || sessionSummary !== null) && (
            <div className="shrink-0 border-b border-blue-900/50 bg-blue-950/30 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-400 mb-2">
                    📋 前回セッションのまとめ
                  </p>
                  {isSummaryLoading ? (
                    <p className="text-xs text-gray-400 animate-pulse">要約を生成中...</p>
                  ) : (
                    <div className="text-sm text-gray-300 space-y-1 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-blue-300 [&_h2]:mt-2 [&_h2]:mb-1 [&_ul]:pl-4 [&_li]:list-disc [&_li]:text-xs [&_li]:text-gray-300 [&_li]:leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {sessionSummary ?? ""}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {!isSummaryLoading && (
                  <button
                    onClick={() => setSessionSummary(null)}
                    className="shrink-0 text-gray-600 hover:text-gray-300 transition text-xs px-1.5 py-0.5 rounded hover:bg-gray-800"
                    aria-label="要約を閉じる"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            mode={mode}
            profile={profile}
            charName={charName}
            onExampleClick={setInput}
            opponentChar={opponentChar}
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
