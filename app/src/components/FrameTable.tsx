"use client";

import { useState, useCallback } from "react";
import type { MoveFrameData, ControlType } from "@/types/frame-data";

/** フレーム値の色クラスを返す */
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

/** ソート可能なカラム */
type SortColumn =
  | "skill"
  | "startup_frame"
  | "active_frame"
  | "recovery_frame"
  | "block_frame"
  | "hit_frame"
  | "damage"
  | null;

interface FrameTableProps {
  moves: MoveFrameData[];
  characterName: string;
}

/** フレーム値を数値に変換（ソート用）。"~" や空文字は Infinity 扱い */
function parseFrameValue(value: string): number {
  const num = parseInt(value, 10);
  return isNaN(num) ? Infinity : num;
}

/** ソートキーに応じた比較値を返す */
function getSortValue(move: MoveFrameData, col: SortColumn): number | string {
  switch (col) {
    case "startup_frame":
      return parseFrameValue(move.startup_frame);
    case "active_frame":
      return parseFrameValue(move.active_frame);
    case "recovery_frame":
      return parseFrameValue(move.recovery_frame);
    case "block_frame":
      return parseFrameValue(move.block_frame);
    case "hit_frame":
      return parseFrameValue(move.hit_frame);
    case "damage":
      return parseFrameValue(move.damage);
    case "skill":
      return move.skill;
    default:
      return 0;
  }
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

/** ソート可能なテーブルヘッダーセル */
function SortableTh({
  label,
  col,
  currentCol,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  col: SortColumn;
  currentCol: SortColumn;
  dir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
  className?: string;
}) {
  const isActive = currentCol === col;
  return (
    <th
      className={`py-2 px-2 font-medium cursor-pointer select-none hover:text-white transition ${
        isActive ? "text-blue-400" : "text-gray-500"
      } ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      {/* ソート方向インジケーター */}
      <span className="ml-1 text-xs">
        {isActive ? (dir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );
}

export default function FrameTable({ moves, characterName }: FrameTableProps) {
  const [controlType, setControlType] = useState<ControlType>("classic");
  const [search, setSearch] = useState("");
  // 技タイプフィルター（null = 全タイプ表示）
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  // ソート状態
  const [sortCol, setSortCol] = useState<SortColumn>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /** カラムヘッダークリック時のソート切替 */
  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
    },
    [sortCol]
  );

  // 操作タイプでフィルタ
  const byControl = moves.filter((m) =>
    controlType === "classic" ? m.command !== null : m.command_modern !== null
  );

  // 技タイプフィルタ
  const byType = typeFilter
    ? byControl.filter((m) => m.move_type === typeFilter)
    : byControl;

  // 検索フィルタ
  const searched = search
    ? byType.filter(
        (m) =>
          m.skill.toLowerCase().includes(search.toLowerCase()) ||
          (m.command || "").toLowerCase().includes(search.toLowerCase()) ||
          (m.command_modern || "").toLowerCase().includes(search.toLowerCase())
      )
    : byType;

  // ソート
  const sorted =
    sortCol !== null
      ? [...searched].sort((a, b) => {
          const av = getSortValue(a, sortCol);
          const bv = getSortValue(b, sortCol);
          let cmp = 0;
          if (typeof av === "number" && typeof bv === "number") {
            cmp = av - bv;
          } else {
            cmp = String(av).localeCompare(String(bv));
          }
          return sortDir === "asc" ? cmp : -cmp;
        })
      : searched;

  // タイプ別にグループ化（ソートが有効なときはグループ化しない）
  const isGrouped = sortCol === null && typeFilter === null;

  const grouped: Record<string, MoveFrameData[]> = {};
  if (isGrouped) {
    for (const move of sorted) {
      const type = move.move_type || "OTHER";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(move);
    }
  }
  const sortedTypes = TYPE_ORDER.filter((t) => grouped[t]);

  // 現在のデータに存在するタイプ一覧（フィルターボタン用）
  const availableTypes = TYPE_ORDER.filter((t) =>
    byControl.some((m) => m.move_type === t)
  );

  return (
    <div>
      {/* コントロール */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
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

        <span className="text-xs text-gray-500">{sorted.length}技</span>
      </div>

      {/* 技タイプフィルターボタン */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* 「すべて」ボタン */}
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
            typeFilter === null
              ? "bg-gray-200 text-gray-900 border-gray-200"
              : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white"
          }`}
        >
          すべて
        </button>
        {availableTypes.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
              typeFilter === t
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white"
            }`}
          >
            {TYPE_LABELS[t] || t}
          </button>
        ))}
        {/* ソート中の場合はリセットボタンを表示 */}
        {sortCol !== null && (
          <button
            onClick={() => setSortCol(null)}
            className="ml-auto px-3 py-1 rounded-full text-xs font-medium text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white transition"
          >
            ソートをリセット
          </button>
        )}
      </div>

      {/* グループ表示（ソートなし・全タイプ表示時） */}
      {isGrouped
        ? sortedTypes.map((type) => {
            const typeMoves = grouped[type];
            return (
              <TypeSection
                key={type}
                type={type}
                typeMoves={typeMoves}
                controlType={controlType}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
              />
            );
          })
        : /* フラット表示（タイプフィルター or ソート有効時） */
          sorted.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              該当する技が見つかりませんでした
            </p>
          ) : (
            <FlatTable
              moves={sorted}
              controlType={controlType}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
    </div>
  );
}

/** タイプ別セクション（アコーディオン） */
function TypeSection({
  type,
  typeMoves,
  controlType,
  sortCol,
  sortDir,
  onSort,
}: {
  type: string;
  typeMoves: MoveFrameData[];
  controlType: ControlType;
  sortCol: SortColumn;
  sortDir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-2 text-base font-semibold text-gray-300 hover:text-white transition"
      >
        <span
          className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        {TYPE_LABELS[type] || type}
        <span className="text-sm font-normal text-gray-500">
          ({typeMoves.length})
        </span>
      </button>

      {expanded && (
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
            <MoveTable
              moves={typeMoves}
              controlType={controlType}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={onSort}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** フラットなテーブル表示（タイプフィルター or ソート時） */
function FlatTable({
  moves,
  controlType,
  sortCol,
  sortDir,
  onSort,
}: {
  moves: MoveFrameData[];
  controlType: ControlType;
  sortCol: SortColumn;
  sortDir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
}) {
  return (
    <>
      {/* スマホ: カード表示 */}
      <div className="md:hidden flex flex-col gap-2">
        {moves.map((move, i) => (
          <MoveCard
            key={`${move.web_id}-${i}`}
            move={move}
            controlType={controlType}
          />
        ))}
      </div>

      {/* PC: テーブル表示 */}
      <div className="hidden md:block overflow-x-auto">
        <MoveTable
          moves={moves}
          controlType={controlType}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </>
  );
}

/** テーブル本体（PC用） */
function MoveTable({
  moves,
  controlType,
  sortCol,
  sortDir,
  onSort,
}: {
  moves: MoveFrameData[];
  controlType: ControlType;
  sortCol: SortColumn;
  sortDir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
}) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-800 text-left">
          <SortableTh
            label="技名"
            col="skill"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
          />
          {/* コマンドはソート対象外 */}
          <th className="py-2 px-2 font-medium text-gray-500">コマンド</th>
          <SortableTh
            label="発生"
            col="startup_frame"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
            className="text-center"
          />
          <SortableTh
            label="持続"
            col="active_frame"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
            className="text-center"
          />
          <SortableTh
            label="硬直"
            col="recovery_frame"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
            className="text-center"
          />
          <SortableTh
            label="ガード"
            col="block_frame"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
            className="text-center"
          />
          <SortableTh
            label="ヒット"
            col="hit_frame"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
            className="text-center"
          />
          <SortableTh
            label="ダメージ"
            col="damage"
            currentCol={sortCol}
            dir={sortDir}
            onSort={onSort}
            className="text-center"
          />
          <th className="py-2 px-2 font-medium text-gray-500 text-center">
            属性
          </th>
          <th className="py-2 px-2 font-medium text-gray-500 text-center">
            C
          </th>
        </tr>
      </thead>
      <tbody>
        {moves.map((move, i) => (
          <tr
            key={`${move.web_id}-${i}`}
            className="border-b border-gray-800/50 hover:bg-gray-900/50"
          >
            <td className="py-2 px-2 text-white">{move.skill}</td>
            <td className="py-2 px-2 text-gray-300 font-mono text-xs">
              {controlType === "classic" ? move.command : move.command_modern}
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
            {/* ガード/ヒットフレームは有利/不利で色分け */}
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
            <td className="py-2 px-2 text-center">{move.damage}</td>
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
  );
}
