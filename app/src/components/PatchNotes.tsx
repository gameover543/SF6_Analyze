/**
 * パッチノート表示コンポーネント
 *
 * data/patches/_meta.json から最新パッチを取得し、
 * 指定キャラクターの変更点を表示する。
 * パッチデータが存在しない場合は何も表示しない。
 */

import fs from "fs";
import path from "path";

// --- 型定義 ---

interface MoveDiff {
  web_id: string;
  move_name: string;
  character_slug: string;
  changed_fields: Record<string, [string, string]>;
  impact_level: "value_changed" | "property_changed" | "removed" | "added";
}

interface CharacterDiff {
  slug: string;
  character_name: string;
  changed_moves: MoveDiff[];
  total_changes: number;
}

interface PatchDiff {
  old_version: string;
  new_version: string;
  diffed_at: string;
  characters: CharacterDiff[];
  summary: string;
}

interface PatchMeta {
  current_version: string;
  patches: Array<{
    old_version: string;
    new_version: string;
    date: string;
    diff_file: string;
  }>;
  last_updated: string;
}

// --- フィールド名の日本語化 ---

const FIELD_NAMES: Record<string, string> = {
  startup_frame: "発生",
  block_frame: "ガード",
  hit_frame: "ヒット",
  damage: "ダメージ",
  active_frame: "持続",
  recovery_frame: "硬直",
  total_frame: "全体",
  cancel: "キャンセル",
  web_cancel: "キャンセル",
  attribute: "属性",
  drive_gauge_gain_hit: "DG補填",
  sa_gauge_gain: "SA補填",
};

// --- impactレベルのラベル/色 ---

const IMPACT_LABEL: Record<MoveDiff["impact_level"], string> = {
  value_changed: "数値変更",
  property_changed: "プロパティ変更",
  removed: "削除",
  added: "追加",
};

const IMPACT_COLOR: Record<MoveDiff["impact_level"], string> = {
  value_changed: "text-yellow-400",
  property_changed: "text-blue-400",
  removed: "text-red-400",
  added: "text-green-400",
};

// --- データ読み込み ---

const PATCHES_DIR = path.join(process.cwd(), "..", "data", "patches");

function loadLatestCharacterDiff(slug: string): {
  charDiff: CharacterDiff | null;
  patch: PatchDiff | null;
} {
  try {
    const metaPath = path.join(PATCHES_DIR, "_meta.json");
    if (!fs.existsSync(metaPath)) return { charDiff: null, patch: null };

    const meta: PatchMeta = JSON.parse(
      fs.readFileSync(metaPath, "utf-8")
    );
    if (!meta.patches || meta.patches.length === 0) {
      return { charDiff: null, patch: null };
    }

    // 最新パッチ（リストの末尾）を使用
    const latest = meta.patches[meta.patches.length - 1];
    const diffPath = path.join(PATCHES_DIR, latest.diff_file);
    if (!fs.existsSync(diffPath)) return { charDiff: null, patch: null };

    const patch: PatchDiff = JSON.parse(fs.readFileSync(diffPath, "utf-8"));
    const charDiff = patch.characters.find((c) => c.slug === slug) ?? null;

    return { charDiff, patch };
  } catch {
    return { charDiff: null, patch: null };
  }
}

// --- コンポーネント ---

interface PatchNotesProps {
  slug: string;
}

export default function PatchNotes({ slug }: PatchNotesProps) {
  const { charDiff, patch } = loadLatestCharacterDiff(slug);

  if (!patch || !charDiff || charDiff.changed_moves.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 rounded-lg border border-yellow-800/50 bg-yellow-950/20 p-5">
      {/* ヘッダー */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-yellow-300">
          前回パッチからの変更点
        </h2>
        <span className="text-xs text-theme-subtle">
          v{patch.old_version} → v{patch.new_version}
        </span>
      </div>

      {/* 変更一覧 */}
      <div className="space-y-3">
        {charDiff.changed_moves.map((move) => (
          <div
            key={move.web_id}
            className="rounded border border-theme-border bg-theme-panel/60 p-3"
          >
            {/* 技名 + impactラベル */}
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium text-white text-sm">
                {move.move_name}
              </span>
              <span
                className={`text-xs ${IMPACT_COLOR[move.impact_level]}`}
              >
                [{IMPACT_LABEL[move.impact_level]}]
              </span>
            </div>

            {/* 変更フィールドの詳細 */}
            {move.impact_level !== "removed" &&
              move.impact_level !== "added" && (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(move.changed_fields).map(
                    ([field, [oldVal, newVal]]) => (
                      <div key={field} className="flex items-center gap-1 text-xs">
                        <span className="text-theme-subtle">
                          {FIELD_NAMES[field] ?? field}:
                        </span>
                        <span className="text-red-400">{oldVal}</span>
                        <span className="text-theme-subtle">→</span>
                        <span className="text-green-400">{newVal}</span>
                      </div>
                    )
                  )}
                </div>
              )}

            {/* 追加・削除の場合はシンプルなメッセージ */}
            {move.impact_level === "added" && (
              <span className="text-xs text-theme-muted">新技として追加</span>
            )}
            {move.impact_level === "removed" && (
              <span className="text-xs text-theme-muted">このパッチで削除</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
