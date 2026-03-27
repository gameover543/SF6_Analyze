"use client";

import { useState, useRef, useEffect } from "react";
import type { CharacterInfo } from "@/types/frame-data";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  characters: CharacterInfo[];
}

export default function ChatInterface({ characters }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [charSearch, setCharSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `エラー: ${data.error}` },
        ]);
      } else {
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー: キャラ選択 */}
        <div className="w-56 border-r border-gray-800 p-4 overflow-y-auto hidden md:block">
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
          <div className="flex flex-col gap-1">
            {filteredChars.map((char) => {
              const isSelected = selectedChars.includes(char.slug);
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
                </button>
              );
            })}
          </div>
        </div>

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col">
          {/* モバイル: キャラ選択 */}
          <div className="md:hidden p-3 border-b border-gray-800">
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => {
                const isSelected = selectedChars.includes(char.slug);
                return (
                  <button
                    key={char.slug}
                    onClick={() => toggleChar(char.slug)}
                    className={`px-2 py-1 rounded text-xs transition ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {char.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* メッセージ一覧 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-20">
                <p className="text-lg mb-2">SF6 AIコーチ</p>
                <p className="text-sm">
                  左のパネルで参照するキャラを選択して質問してください。
                </p>
                <div className="mt-6 flex flex-col gap-2 items-center">
                  <p className="text-xs text-gray-600">質問の例:</p>
                  {[
                    "ジェイミーの確反に使える技は？",
                    "JP戦でどう立ち回ればいい？",
                    "ガード後に発生6F以下の技は？",
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
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
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
            {selectedChars.length > 0 && (
              <div className="flex gap-2 mb-2">
                {selectedChars.map((slug) => {
                  const char = characters.find((c) => c.slug === slug);
                  return (
                    <span
                      key={slug}
                      className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded"
                    >
                      {char?.name}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="質問を入力..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
