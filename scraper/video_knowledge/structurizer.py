"""ナレッジ構造化: カテゴリ・マッチアップ別インデックスを事前構築する

LLMを使わずコードだけで実行。パイプライン完了後に毎回走らせる。

生成物:
  data/knowledge/_structured/
    ├── by_matchup/{slug}_vs_{opponent}.json   # マッチアップ別
    ├── by_category/{slug}_{category}.json     # カテゴリ別
    ├── by_situation/{situation_tag}.json       # 状況別（画面端、起き攻め等）
    └── _manifest.json                         # 全インデックスのマニフェスト
"""

import json
import logging
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .config import PipelineConfig, CHARACTER_JP_NAMES
from .sources import DataStore

logger = logging.getLogger(__name__)

# 状況タグの正規化マッピング（表記揺れを統一）
SITUATION_NORMALIZE: dict[str, str] = {
    "起き攻め時": "起き攻め",
    "起き攻め": "起き攻め",
    "相手ダウン時": "起き攻め",
    "画面中央": "中央",
    "中央": "中央",
    "画面端": "画面端",
    "端": "画面端",
    "対空": "対空",
    "地上戦": "立ち回り",
    "立ち回り": "立ち回り",
    "中距離": "立ち回り",
    "遠距離": "立ち回り",
    "近距離": "近距離",
    "密着": "近距離",
    "パニッシュカウンター": "パニカン",
    "パニッシュカウンター時": "パニカン",
    "相手の攻撃に対して": "防御",
    "相手に攻め込まれている時": "防御",
    "守り": "防御",
    "バーンアウト": "バーンアウト",
    "バーンアウト時": "バーンアウト",
}

# 主要な状況タグ（インデックス対象）
PRIMARY_SITUATIONS = [
    "起き攻め", "画面端", "中央", "対空", "立ち回り",
    "近距離", "防御", "パニカン", "バーンアウト",
]


def build_structured_index(config: PipelineConfig | None = None) -> dict:
    """全ナレッジから構造化インデックスを構築"""
    if config is None:
        config = PipelineConfig()

    store = DataStore(config)
    structured_dir = config.knowledge_dir / "_structured"
    by_matchup_dir = structured_dir / "by_matchup"
    by_category_dir = structured_dir / "by_category"
    by_situation_dir = structured_dir / "by_situation"

    # ディレクトリ作成
    for d in [by_matchup_dir, by_category_dir, by_situation_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # 全エントリを収集
    all_entries = []
    for slug in list(CHARACTER_JP_NAMES.keys()) + ["general"]:
        knowledge = store.load_character_knowledge(slug)
        for entry in knowledge.entries:
            all_entries.append(entry.model_dump())

    logger.info(f"構造化対象: {len(all_entries)}件")

    # --- マッチアップ別インデックス ---
    matchup_index: dict[str, list[dict]] = defaultdict(list)
    for entry in all_entries:
        if entry.get("matchup"):
            for char in entry.get("characters", []):
                key = f"{char}_vs_{entry['matchup']}"
                matchup_index[key].append(entry)

    matchup_files = 0
    for key, entries in matchup_index.items():
        if len(entries) >= 2:  # 2件以上のみインデックス化
            path = by_matchup_dir / f"{key}.json"
            path.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
            matchup_files += 1

    # --- カテゴリ別インデックス ---
    category_index: dict[str, list[dict]] = defaultdict(list)
    for entry in all_entries:
        for char in entry.get("characters", []):
            key = f"{char}_{entry.get('category', 'general')}"
            category_index[key].append(entry)

    category_files = 0
    for key, entries in category_index.items():
        path = by_category_dir / f"{key}.json"
        path.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
        category_files += 1

    # --- 状況別インデックス ---
    situation_index: dict[str, list[dict]] = defaultdict(list)
    for entry in all_entries:
        situation = entry.get("situation", "")
        if not situation:
            continue
        # 状況タグを正規化して分類
        normalized_tags = _normalize_situation(situation)
        for tag in normalized_tags:
            if tag in PRIMARY_SITUATIONS:
                situation_index[tag].append(entry)

    situation_files = 0
    for tag, entries in situation_index.items():
        path = by_situation_dir / f"{tag}.json"
        path.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
        situation_files += 1

    # --- マニフェスト ---
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(all_entries),
        "matchup_indexes": matchup_files,
        "category_indexes": category_files,
        "situation_indexes": situation_files,
        "matchup_pairs": sorted(matchup_index.keys()),
        "situations": sorted(situation_index.keys()),
    }
    (structured_dir / "_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2)
    )

    logger.info(
        f"構造化完了: マッチアップ{matchup_files}件, "
        f"カテゴリ{category_files}件, 状況{situation_files}件"
    )
    return manifest


def _normalize_situation(situation: str) -> list[str]:
    """状況テキストを正規化されたタグのリストに変換"""
    tags = set()
    # 「、」「/」「,」で分割
    parts = re.split(r'[、/,]', situation)
    for part in parts:
        part = part.strip()
        # 正規化マッピングに一致するか
        if part in SITUATION_NORMALIZE:
            tags.add(SITUATION_NORMALIZE[part])
        else:
            # 部分一致で探す
            for key, normalized in SITUATION_NORMALIZE.items():
                if key in part:
                    tags.add(normalized)
                    break
    return list(tags)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    result = build_structured_index()
    print(f"\n構造化完了:")
    print(f"  マッチアップ: {result['matchup_indexes']}ファイル")
    print(f"  カテゴリ: {result['category_indexes']}ファイル")
    print(f"  状況: {result['situation_indexes']}ファイル")
