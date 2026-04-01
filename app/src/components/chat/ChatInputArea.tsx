"use client";

interface ChatInputAreaProps {
  input: string;
  isLoading: boolean;
  mode: "counseling" | "coaching" | "matchup";
  selectedChars: string[];
  charName: (slug: string) => string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onOpenSidebar: () => void;
}

/** チャット入力エリア（テキストフィールド・送信ボタン・モバイル用キャラ表示）を担当 */
export default function ChatInputArea({
  input,
  isLoading,
  mode,
  selectedChars,
  charName,
  onInputChange,
  onSend,
  onOpenSidebar,
}: ChatInputAreaProps) {
  return (
    <div className="border-t border-theme-border p-4">
      {/* モバイル: 選択キャラ表示 */}
      {selectedChars.length > 0 && (mode === "coaching" || mode === "matchup") && (
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
            onClick={onOpenSidebar}
            className="text-xs text-theme-subtle hover:text-theme-muted"
          >
            変更
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder={
            mode === "counseling"
              ? "コーチに話しかけてください..."
              : mode === "matchup"
              ? "このマッチアップについて質問..."
              : "質問を入力..."
          }
          className="flex-1 px-4 py-3 rounded-xl bg-theme-panel border border-theme-border text-theme-text placeholder-theme-subtle focus:outline-none focus:border-blue-500"
          disabled={isLoading}
        />
        <button
          onClick={onSend}
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          送信
        </button>
      </div>
    </div>
  );
}
