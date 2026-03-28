"use client";

import { useState } from "react";
import type { MoveFrameData, ControlType } from "@/types/frame-data";

/** フレーム値の色を返す */
function frameColor(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) return "text-gray-400";
  if (num > 0) return "text-blue-400";
  if (num < 0) return "text-red-400";
  return "text-yellow-400";
}

/** フレーム値のバッジ背景色 */
function frameBg(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) return "bg-gray-800";
  if (num > 0) return "bg-blue-900/50";
  if (num < 0) return "bg-red-900/50";
  return "bg-yellow-900/50";
}

/** 技タイプの日本語ラベル */
const TYPE_LABELS: Record<string, string> = {
  NORMAL: "通常技",
  UNIQUE: "特殊技",
  SPECIAL: "必殺技",
  SA: "スーパーアーツ",
  THROW: "投げ",
  COMMON: "共通技",
};

/** 技タイプの表示順 */
const TYPE_ORDER = ["NORMAL", "UNIQUE", "SPECIAL", "SA", "THROW", "COMMON"];

interface FrameTableProps {
  moves: MoveFrameData[];
  characterName: string;
}

/** スマホ用: 1技分のカード表示 */
function MoveCard({
  move,
  controlType,
}: {
  move: MoveFrameData;
  controlType: ControlType;
}) {
  const cmd = controlType === "classic" ? move.command : move.command_modern;

  return (
    <div className="border border-gray-800 rounded-lg p-3 hover:bg-gray-900/50">
      {/* 技名 + コマンド */}
      <div className="mb-2">
        <div className="text-white font-medium text-sm">{move.skill}</div>
        {cmd && (
          <div className="text-gray-400 font-mono text-xs mt-0.5">{cmd}</div>
        )}
      </div>

      {/* フレームデータ（グリッド） */}
      <div className="grid grid-cols-4 gap-1.5 text-xs">
        <div className="text-center">
          <div className="text-gray-500">発生</div>
          <div className="text-yellow-300 font-medium">
            {move.startup_frame || "-"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">ガード</div>
          <div
            className={`font-medium rounded px-1 ${frameBg(move.block_frame)} ${frameColor(move.block_frame)}`}
          >
            {move.block_frame || "-"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">ヒット</div>
          <div
            className={`font-medium rounded px-1 ${frameBg(move.hit_frame)} ${frameColor(move.hit_frame)}`}
          >
            {move.hit_frame || "-"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">ダメージ</div>
          <div className="text-white font-medium">{move.damage || "-"}</div>
        </div>
      </div>
    </div>
  );
}

export default function FrameTable({ moves, characterName }: FrameTableProps) {
  const [controlType, setControlType] = useState<ControlType>("classic");
  const [search, setSearch] = useState("");
  const [expandedType, setExpandedType] = useState<string | null>(null);

  // 操作タイプでフィルタ
  const filtered = moves.filter((m) =>
    controlType === "classic" ? m.command !== null : m.command_modern !== null
  );

  // 検索フィルタ
  const searched = search
    ? filtered.filter(
        (m) =>
          m.skill.toLowerCase().includes(search.toLowerCase()) ||
          (m.command || "").toLowerCase().includes(search.toLowerCase()) ||
          (m.command_modern || "").toLowerCase().includes(search.toLowerCase())
      )
    : filtered;

  // タイプ別にグループ化
  const grouped: Record<string, MoveFrameData[]> = {};
  for (const move of searched) {
    const type = move.move_type || "OTHER";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(move);
  }

  const sortedTypes = TYPE_ORDER.filter((t) => grouped[t]);

  return (
    <div>
      {/* コントロール */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Classic/Modern切替 */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => setControlType("classic")}
            className={`px-4 py-2 text-sm font-medium transition ${
              controlType === "classic"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            Classic
          </button>
          <button
            onClick={() => setControlType("modern")}
            className={`px-4 py-2 text-sm font-medium transition ${
              controlType === "modern"
                ? "bg-green-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            Modern
          </button>
        </div>

        {/* 検索 */}
        <input
          type="text"
          placeholder="技名・コマンドで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <span className="text-xs text-gray-500">
          {searched.length}技
        </span>
      </div>

      {/* 技リスト */}
      {sortedTypes.map((type) => {
        const typeMoves = grouped[type];
        const isExpanded =
          expandedType === null || expandedType === type || search !== "";

        return (
          <div key={type} className="mb-6">
            <button
              onClick={() =>
                setExpandedType(expandedType === type ? null : type)
              }
              className="flex items-center gap-2 mb-2 text-base font-semibold text-gray-300 hover:text-white transition"
            >
              <span
                className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              {TYPE_LABELS[type] || type}
              <span className="text-sm font-normal text-gray-500">
                ({typeMoves.length})
              </span>
            </button>

            {isExpanded && (
              <>
                {/* スマホ: カード表示 */}
                <div className="md:hidden flex flex-col gap-2">
                  {typeMoves.map((move, i) => (
                    <MoveCard
                      key={`${move.web_id}-${i}`}
                      move={move}
                      controlType={controlType}
                    />
                  ))}
                </div>

                {/* PC: テーブル表示 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 text-left">
                        <th className="py-2 px-2 font-medium">技名</th>
                        <th className="py-2 px-2 font-medium">コマンド</th>
                        <th className="py-2 px-2 font-medium text-center">
                          発生
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          持続
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          硬直
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          ガード
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          ヒット
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          ダメージ
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          属性
                        </th>
                        <th className="py-2 px-2 font-medium text-center">
                          C
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeMoves.map((move, i) => (
                        <tr
                          key={`${move.web_id}-${i}`}
                          className="border-b border-gray-800/50 hover:bg-gray-900/50"
                        >
                          <td className="py-2 px-2 text-white">{move.skill}</td>
                          <td className="py-2 px-2 text-gray-300 font-mono text-xs">
                            {controlType === "classic"
                              ? move.command
                              : move.command_modern}
                          </td>
                          <td className="py-2 px-2 text-center text-yellow-300">
                            {move.startup_frame}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400">
                            {move.active_frame}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400">
                            {move.recovery_frame}
                          </td>
                          <td
                            className={`py-2 px-2 text-center font-medium ${frameColor(move.block_frame)}`}
                          >
                            {move.block_frame}
                          </td>
                          <td
                            className={`py-2 px-2 text-center font-medium ${frameColor(move.hit_frame)}`}
                          >
                            {move.hit_frame}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {move.damage}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400">
                            {move.attribute}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400">
                            {move.web_cancel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
