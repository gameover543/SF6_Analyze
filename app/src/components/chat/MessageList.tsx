"use client";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
        <div className="text-center text-theme-muted mt-8 sm:mt-20">
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
              <p className="text-sm text-theme-muted mb-4">
                {charName(profile?.mainCharacter || "")} vs {charName(opponentChar)}
              </p>
              <p className="text-xs text-theme-subtle mb-6">
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
                    className="text-xs text-theme-subtle hover:text-theme-text px-3 py-1.5 border border-theme-border rounded-lg hover:border-theme-raised transition"
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
                    className="text-xs text-theme-subtle hover:text-theme-text px-3 py-1.5 border border-theme-border rounded-lg hover:border-theme-raised transition"
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
            className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 text-white whitespace-pre-wrap"
                : "bg-theme-raised text-theme-text markdown-body"
            }`}
          >
            {msg.role === "user" ? (
              msg.content
            ) : (
              /* AIの応答をMarkdownとしてレンダリング */
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // 見出し
                  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                  // 段落
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  // 太字・斜体
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                  // リスト
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 pl-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 pl-1">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-100">{children}</li>,
                  // インラインコード（コマンド表記用）
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    return isBlock ? (
                      <code className="block bg-gray-900 text-green-400 text-xs rounded px-3 py-2 my-2 overflow-x-auto font-mono whitespace-pre">
                        {children}
                      </code>
                    ) : (
                      <code className="bg-gray-900 text-green-400 text-xs rounded px-1.5 py-0.5 font-mono">
                        {children}
                      </code>
                    );
                  },
                  // コードブロック（pre要素はcodeに任せるため余白のみ）
                  pre: ({ children }) => <pre className="my-1">{children}</pre>,
                  // テーブル
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-gray-700">{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-gray-700">{children}</tr>,
                  th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-gray-200 whitespace-nowrap">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-1.5 text-gray-300">{children}</td>,
                  // 水平線
                  hr: () => <hr className="border-gray-600 my-2" />,
                  // 引用
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-gray-500 pl-3 my-2 text-gray-400 italic">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-theme-raised px-4 py-3 rounded-2xl text-sm text-theme-muted">
            考え中...
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
