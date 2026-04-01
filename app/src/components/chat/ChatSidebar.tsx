"use client";
import type { CharacterInfo } from "@/types/frame-data";
import type { UserProfile } from "@/types/profile";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  mode: "counseling" | "coaching";
  selectedChars: string[];
  filteredChars: CharacterInfo[];
  charSearch: string;
  onCharSearchChange: (value: string) => void;
  onToggleChar: (slug: string) => void;
  onShowConfirm: (type: "reset-chat" | "reset-profile") => void;
  charName: (slug: string) => string;
}

/** コーチングサイドバー：プロフィール表示とキャラ選択を担当 */
export default function ChatSidebar({
  isOpen,
  onClose,
  profile,
  mode,
  selectedChars,
  filteredChars,
  charSearch,
  onCharSearchChange,
  onToggleChar,
  onShowConfirm,
  charName,
}: ChatSidebarProps) {
  return (
    <>
      {/* モバイルオーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed md:relative z-40 top-0 left-0 h-full w-64
          border-r border-gray-800 bg-gray-950 p-4 overflow-y-auto
          flex flex-col transition-transform duration-200
          md:translate-x-0 md:w-56
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* モバイル: 閉じるボタン */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 p-1 text-gray-500 hover:text-white"
          aria-label="閉じる"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>

        {/* プロフィールカード */}
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
              onChange={(e) => onCharSearchChange(e.target.value)}
              className="w-full px-2 py-1.5 mb-3 rounded bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
              {filteredChars.map((char) => {
                const isSelected = selectedChars.includes(char.slug);
                const isMain = char.slug === profile?.mainCharacter;
                return (
                  <button
                    key={char.slug}
                    onClick={() => onToggleChar(char.slug)}
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
              onClick={() => { onShowConfirm("reset-chat"); onClose(); }}
              className="text-xs text-gray-500 hover:text-white text-left transition"
            >
              新しい会話を始める
            </button>
          )}
          <button
            onClick={() => { onShowConfirm("reset-profile"); onClose(); }}
            className="text-xs text-gray-600 hover:text-orange-400 text-left transition"
          >
            プロフィール変更
          </button>
        </div>
      </div>
    </>
  );
}
