"""ナレッジ再バリデーション: パッチdiff検出後に全ナレッジを再検証する

パッチで変更された技に言及するナレッジエントリを特定し、
staleness_status を設定してconfidenceを調整する。
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from .schemas import (
    KnowledgeEntry, CharacterKnowledge, PatchDiff, MoveDiff,
)
from .move_resolver import MoveResolver
from .sources import DataStore
from .config import PipelineConfig, CHARACTER_JP_NAMES

logger = logging.getLogger(__name__)


def revalidate_knowledge(diff: PatchDiff, data_dir: Path) -> dict:
    """パッチdiffに基づいてナレッジを再バリデーション

    Returns: {slug: {"flagged": int, "confirmed_stale": int, "possibly_stale": int}}
    """
    config = PipelineConfig()
    config.data_dir = data_dir
    config.knowledge_dir = data_dir / "knowledge"
    config.frame_data_dir = data_dir / "frame_data"

    store = DataStore(config)
    resolver = MoveResolver(config.frame_data_dir)

    # 変更された技のインデックスを構築: {(slug, web_id): MoveDiff}
    changed_index: dict[tuple[str, str], MoveDiff] = {}
    affected_slugs: set[str] = set()

    for char_diff in diff.characters:
        for move_diff in char_diff.changed_moves:
            key = (char_diff.slug, move_diff.web_id)
            changed_index[key] = move_diff
            affected_slugs.add(char_diff.slug)

    logger.info(
        f"再バリデーション開始: {len(affected_slugs)}キャラ, "
        f"{len(changed_index)}技が変更"
    )

    results: dict[str, dict] = {}

    # 影響を受ける可能性のある全キャラのナレッジを走査
    for slug in CHARACTER_JP_NAMES:
        knowledge = store.load_character_knowledge(slug)
        if not knowledge.entries:
            continue

        flagged = 0
        confirmed = 0
        possibly = 0

        for entry in knowledge.entries:
            # このエントリが影響を受けるか判定
            impact = _check_entry_impact(
                entry, changed_index, affected_slugs, resolver
            )

            if impact == "confirmed_stale":
                entry.staleness_status = "confirmed_stale"
                entry.confidence = min(entry.confidence, 0.2)
                confirmed += 1
                flagged += 1
            elif impact == "possibly_stale":
                entry.staleness_status = "possibly_stale"
                entry.confidence = min(entry.confidence, 0.5)
                possibly += 1
                flagged += 1
            else:
                # 変更の影響なし → currentを維持
                if entry.staleness_status != "current":
                    # 以前staleだったが、今回の変更で解消された可能性
                    # → 安全のためそのまま維持（手動確認が必要）
                    pass

            entry.last_validated_version = diff.new_version

        if flagged > 0:
            knowledge.last_validated_version = diff.new_version
            store.save_character_knowledge(knowledge)
            results[slug] = {
                "flagged": flagged,
                "confirmed_stale": confirmed,
                "possibly_stale": possibly,
            }
            logger.info(
                f"  {slug}: {flagged}件フラグ "
                f"(confirmed={confirmed}, possibly={possibly})"
            )

    total_flagged = sum(r["flagged"] for r in results.values())
    logger.info(f"再バリデーション完了: 合計{total_flagged}件をフラグ付け")

    return results


def _check_entry_impact(
    entry: KnowledgeEntry,
    changed_index: dict[tuple[str, str], MoveDiff],
    affected_slugs: set[str],
    resolver: MoveResolver,
) -> str:
    """エントリが変更の影響を受けるか判定

    Returns: "confirmed_stale" | "possibly_stale" | "none"
    """
    # このエントリが関係するキャラが変更対象でなければスキップ
    entry_slugs = set(entry.characters)
    if not entry_slugs & affected_slugs:
        return "none"

    worst_impact = "none"

    for slug in entry_slugs & affected_slugs:
        # 方法1: referenced_moves が設定されている場合は直接照合
        if entry.referenced_moves:
            for web_id in entry.referenced_moves:
                key = (slug, web_id)
                if key in changed_index:
                    move_diff = changed_index[key]
                    impact = _classify_impact(move_diff)
                    entry.staleness_reason = _build_reason(move_diff)
                    worst_impact = _worse(worst_impact, impact)

        # 方法2: テキストから技名を解決して照合
        resolved_ids = resolver.resolve_for_entry(
            entry.content, entry.source_quote, [slug]
        )
        for web_id in resolved_ids:
            key = (slug, web_id)
            if key in changed_index:
                move_diff = changed_index[key]
                impact = _classify_impact(move_diff)
                if not entry.staleness_reason:
                    entry.staleness_reason = _build_reason(move_diff)
                worst_impact = _worse(worst_impact, impact)

    return worst_impact


def _classify_impact(move_diff: MoveDiff) -> str:
    """MoveDiffからstaleness影響レベルを判定"""
    if move_diff.impact_level in ("property_changed", "removed"):
        return "confirmed_stale"
    elif move_diff.impact_level in ("value_changed", "added"):
        return "possibly_stale"
    return "none"


def _build_reason(move_diff: MoveDiff) -> str:
    """変更理由の説明テキストを生成"""
    if move_diff.impact_level == "removed":
        return f"{move_diff.move_name} が削除"
    if move_diff.impact_level == "added":
        return f"{move_diff.move_name} が追加"

    parts = []
    for field, (old, new) in move_diff.changed_fields.items():
        field_names = {
            "startup_frame": "発生", "block_frame": "ガード",
            "hit_frame": "ヒット", "damage": "ダメージ",
            "cancel": "キャンセル", "web_cancel": "キャンセル",
            "attribute": "属性",
        }
        fname = field_names.get(field, field)
        parts.append(f"{fname}{old}→{new}")

    return f"{move_diff.move_name}: {', '.join(parts)}"


def _worse(a: str, b: str) -> str:
    """より深刻な影響レベルを返す"""
    order = {"none": 0, "possibly_stale": 1, "confirmed_stale": 2}
    return a if order.get(a, 0) >= order.get(b, 0) else b
