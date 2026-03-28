"""動画候補キュー・インデックス・ナレッジファイルの永続化管理"""

import json
import logging
from pathlib import Path
from datetime import datetime

from .schemas import (
    PipelineIndex,
    DiscoveryQueue,
    CharacterKnowledge,
    KnowledgeEntry,
    VideoProcessingRecord,
    ChannelProfile,
    CoverageMatrix,
    VideoCandidate,
)
from .config import PipelineConfig

logger = logging.getLogger(__name__)


class DataStore:
    """data/knowledge/ 以下のファイル読み書きを一元管理"""

    def __init__(self, config: PipelineConfig):
        self.knowledge_dir = config.knowledge_dir
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)

    # --- パス ---

    def _index_path(self) -> Path:
        return self.knowledge_dir / "_index.json"

    def _queue_path(self) -> Path:
        return self.knowledge_dir / "_discovery_queue.json"

    def _channels_path(self) -> Path:
        return self.knowledge_dir / "_channels.json"

    def _coverage_path(self) -> Path:
        return self.knowledge_dir / "_coverage.json"

    def _character_path(self, slug: str) -> Path:
        return self.knowledge_dir / f"{slug}.json"

    # --- インデックス ---

    def load_index(self) -> PipelineIndex:
        path = self._index_path()
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return PipelineIndex(**data)
        return PipelineIndex()

    def save_index(self, index: PipelineIndex) -> None:
        index.last_updated = datetime.now().isoformat()
        self._index_path().write_text(
            index.model_dump_json(indent=2), encoding="utf-8"
        )

    # --- 発見キュー ---

    def load_queue(self) -> DiscoveryQueue:
        path = self._queue_path()
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return DiscoveryQueue(**data)
        return DiscoveryQueue()

    def save_queue(self, queue: DiscoveryQueue) -> None:
        queue.last_updated = datetime.now().isoformat()
        self._queue_path().write_text(
            queue.model_dump_json(indent=2), encoding="utf-8"
        )

    # --- チャンネル ---

    def load_channels(self) -> dict[str, ChannelProfile]:
        """チャンネル名→プロファイルの辞書を返す"""
        path = self._channels_path()
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return {
                name: ChannelProfile(**profile)
                for name, profile in data.items()
            }
        return {}

    def save_channels(self, channels: dict[str, ChannelProfile]) -> None:
        data = {
            name: profile.model_dump()
            for name, profile in channels.items()
        }
        self._channels_path().write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # --- カバレッジ ---

    def load_coverage(self) -> CoverageMatrix:
        path = self._coverage_path()
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return CoverageMatrix(**data)
        return CoverageMatrix()

    def save_coverage(self, coverage: CoverageMatrix) -> None:
        coverage.last_updated = datetime.now().isoformat()
        self._coverage_path().write_text(
            coverage.model_dump_json(indent=2), encoding="utf-8"
        )

    # --- キャラ別ナレッジ ---

    def load_character_knowledge(self, slug: str) -> CharacterKnowledge:
        path = self._character_path(slug)
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return CharacterKnowledge(**data)
        return CharacterKnowledge(slug=slug)

    def save_character_knowledge(self, knowledge: CharacterKnowledge) -> None:
        knowledge.last_updated = datetime.now().isoformat()
        self._character_path(knowledge.slug).write_text(
            knowledge.model_dump_json(indent=2), encoding="utf-8"
        )

    def add_entries(self, entries: list[KnowledgeEntry]) -> int:
        """ナレッジエントリを各キャラファイルに振り分けて保存。追加件数を返す"""
        added = 0
        # キャラ別にグループ化
        by_char: dict[str, list[KnowledgeEntry]] = {}
        for entry in entries:
            for slug in entry.characters:
                by_char.setdefault(slug, []).append(entry)

        for slug, char_entries in by_char.items():
            knowledge = self.load_character_knowledge(slug)
            existing_ids = {e.id for e in knowledge.entries}

            for entry in char_entries:
                if not entry.id:
                    entry.generate_id()
                if entry.id not in existing_ids:
                    knowledge.entries.append(entry)
                    existing_ids.add(entry.id)
                    added += 1

            # ソース動画数を更新
            video_ids = {e.source_video_id for e in knowledge.entries}
            knowledge.source_video_count = len(video_ids)
            self.save_character_knowledge(knowledge)

        return added
