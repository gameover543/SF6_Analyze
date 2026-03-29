"""フレームデータDiffエンジン: パッチ前後の変更を検出する

scraper/main.py --force 実行時に自動呼び出しされる。
旧フレームデータと新フレームデータを比較し、変更された技を特定する。
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from video_knowledge.schemas import (
    MoveDiff, CharacterDiff, PatchDiff, PatchMeta,
)

logger = logging.getLogger(__name__)

# diff対象フィールド
VALUE_FIELDS = {
    "startup_frame", "block_frame", "hit_frame", "damage",
    "active_frame", "recovery_frame", "total_frame",
    "drive_gauge_gain_hit", "sa_gauge_gain",
}
PROPERTY_FIELDS = {
    "cancel", "web_cancel", "attribute",
}
ALL_DIFF_FIELDS = VALUE_FIELDS | PROPERTY_FIELDS


def snapshot_frame_data(frame_data_dir: Path) -> dict[str, dict]:
    """現在のフレームデータをメモリにスナップショット"""
    snapshot = {}
    for f in frame_data_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            snapshot[f.stem] = data
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"スナップショット失敗 ({f.name}): {e}")
    logger.info(f"フレームデータスナップショット: {len(snapshot)}キャラ")
    return snapshot


def compute_diff(
    old_data: dict[str, dict],
    new_data: dict[str, dict],
) -> PatchDiff | None:
    """旧フレームデータと新フレームデータのdiffを計算"""
    # バージョン取得
    old_version = _get_version(old_data)
    new_version = _get_version(new_data)

    # バージョンが同じでも技データに差異がある場合があるため、常にdiffを実行
    characters: list[CharacterDiff] = []

    for slug in sorted(set(old_data.keys()) | set(new_data.keys())):
        old_char = old_data.get(slug, {})
        new_char = new_data.get(slug, {})

        old_moves = _get_moves(old_char)
        new_moves = _get_moves(new_char)

        # web_id でインデックス
        old_by_id = {m.get("web_id", ""): m for m in old_moves if m.get("web_id")}
        new_by_id = {m.get("web_id", ""): m for m in new_moves if m.get("web_id")}

        changed_moves: list[MoveDiff] = []

        # 変更 & 削除
        for web_id, old_move in old_by_id.items():
            if web_id not in new_by_id:
                changed_moves.append(MoveDiff(
                    web_id=web_id,
                    move_name=old_move.get("skill", ""),
                    character_slug=slug,
                    impact_level="removed",
                ))
                continue

            new_move = new_by_id[web_id]
            changed_fields: dict[str, list[str]] = {}

            for field in ALL_DIFF_FIELDS:
                old_val = str(old_move.get(field, ""))
                new_val = str(new_move.get(field, ""))
                if old_val != new_val:
                    changed_fields[field] = [old_val, new_val]

            if changed_fields:
                # 影響レベル判定
                if any(f in PROPERTY_FIELDS for f in changed_fields):
                    impact = "property_changed"
                else:
                    impact = "value_changed"

                changed_moves.append(MoveDiff(
                    web_id=web_id,
                    move_name=new_move.get("skill", ""),
                    character_slug=slug,
                    changed_fields=changed_fields,
                    impact_level=impact,
                ))

        # 追加
        for web_id in new_by_id:
            if web_id not in old_by_id:
                changed_moves.append(MoveDiff(
                    web_id=web_id,
                    move_name=new_by_id[web_id].get("skill", ""),
                    character_slug=slug,
                    impact_level="added",
                ))

        if changed_moves:
            char_name = new_char.get("character_name", slug)
            characters.append(CharacterDiff(
                slug=slug,
                character_name=char_name,
                changed_moves=changed_moves,
                total_changes=len(changed_moves),
            ))

    if not characters:
        logger.info("フレームデータに変更なし")
        return None

    # サマリー生成
    summary = _generate_summary(characters)

    diff = PatchDiff(
        old_version=old_version or "unknown",
        new_version=new_version or "unknown",
        diffed_at=datetime.now().isoformat(),
        characters=characters,
        summary=summary,
    )

    total_changes = sum(c.total_changes for c in characters)
    logger.info(
        f"パッチdiff検出: v{old_version}→v{new_version}, "
        f"{len(characters)}キャラ, {total_changes}技変更"
    )
    return diff


def save_diff(diff: PatchDiff, patches_dir: Path) -> Path:
    """PatchDiffをJSONファイルに保存"""
    patches_dir.mkdir(parents=True, exist_ok=True)

    filename = f"v{diff.old_version}_to_v{diff.new_version}.json"
    filepath = patches_dir / filename
    filepath.write_text(
        diff.model_dump_json(indent=2), encoding="utf-8"
    )

    # _meta.json 更新
    meta_path = patches_dir / "_meta.json"
    if meta_path.exists():
        meta = PatchMeta(**json.loads(meta_path.read_text(encoding="utf-8")))
    else:
        meta = PatchMeta()

    meta.current_version = diff.new_version
    meta.patches.append({
        "old_version": diff.old_version,
        "new_version": diff.new_version,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "diff_file": filename,
    })
    meta.last_updated = datetime.now().isoformat()
    meta_path.write_text(
        meta.model_dump_json(indent=2), encoding="utf-8"
    )

    logger.info(f"パッチdiff保存: {filepath}")
    return filepath


def _generate_summary(characters: list[CharacterDiff]) -> str:
    """AIプロンプト注入用のパッチ変更サマリーを生成"""
    lines = []
    for char in characters:
        move_descs = []
        for m in char.changed_moves[:5]:  # 多すぎる場合は上位5技
            if m.impact_level == "removed":
                move_descs.append(f"{m.move_name} 削除")
            elif m.impact_level == "added":
                move_descs.append(f"{m.move_name} 追加")
            else:
                for field, (old, new) in m.changed_fields.items():
                    field_jp = _field_name_jp(field)
                    move_descs.append(f"{m.move_name} {field_jp}{old}→{new}")

        if char.total_changes > 5:
            move_descs.append(f"他{char.total_changes - 5}技")

        lines.append(f"{char.character_name}: {', '.join(move_descs)}")

    return "\n".join(lines)


def _get_version(data: dict[str, dict]) -> str:
    """データ群からバージョンを取得"""
    for char_data in data.values():
        if isinstance(char_data, dict) and "version" in char_data:
            return str(char_data["version"])
    return ""


def _get_moves(char_data: dict) -> list[dict]:
    """キャラデータから技リストを取得"""
    if isinstance(char_data, list):
        return char_data
    if isinstance(char_data, dict):
        return char_data.get("moves", [])
    return []


def _field_name_jp(field: str) -> str:
    """フィールド名の日本語化"""
    mapping = {
        "startup_frame": "発生",
        "block_frame": "ガード",
        "hit_frame": "ヒット",
        "damage": "ダメージ",
        "active_frame": "持続",
        "recovery_frame": "硬直",
        "total_frame": "全体",
        "cancel": "キャンセル",
        "web_cancel": "キャンセル",
        "attribute": "属性",
    }
    return mapping.get(field, field)
