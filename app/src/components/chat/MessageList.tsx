"use client";
import { useEffect, useRef } from "react";
import type { Message } from "@/hooks/useChatMessages";
import type { UserProfile } from "@/types/profile";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  mode: "counseling" | "coaching" | "matchup";
  profile: UserProfile | null;
  charName: (slug: string) => string;
  /** 例文・クイックスタートボタン押下時に入力欄へテキストをセットするコールバック */
  onExampleClick: (text: string) => void;
  /** マッチアップモード時の対戦相手キャラslug */
  opponentChar?: string | null;
}

/** メッセージ一覧・空状態・ローディング表示を担当するコンポーネント */
export default function MessageList({
  messages,
  isLoading,
  mode,
  profile,
  charName,
  onExampleClick,
  opponentChar,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // メッセージが追加されたら末尾へ自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
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
                onClick={() => onExampleClick("よろしくお願いします")}
                className="text-sm text-blue-400 hover:text-blue-300 px-4 py-2 border border-blue-500/30 rounded-lg hover:border-blue-400/50 transition"
              >
                コーチングを始める
              </button>
            </>
          ) : mode === "matchup" && opponentChar ? (
            <>
              <p className="text-lg mb-1 text-purple-300">マッチアップ分析モード</p>
              <p className="text-sm text-gray-400 mb-4">
                {charName(profile?.mainCharacter || "")} vs {charName(opponentChar)}
              </p>
              <p className="text-xs text-gray-600 mb-6">
                このマッチアップに特化したアドバイスを提供します。
              </p>
              <div className="mt-2 flex flex-col gap-2 items-center">
                {[
                  `${charName(opponentChar)}に勝つための基本的な立ち回りは？`,
                  `${charName(opponentChar)}の強い技への対処法は？`,
                  `${charName(opponentChar)}戦で意識すべきポイントは？`,
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => onExampleClick(example)}
                    className="text-xs text-gray-500 hover:text-white px-3 py-1.5 border border-gray-800 rounded-lg hover:border-gray-600 transition"
                  >
                    {example}
                  </button>
                ))}
              </div>
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
                    onClick={() => onExampleClick(example)}
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
  );
}
