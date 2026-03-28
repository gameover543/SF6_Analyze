"""ナレッジパイプラインのデータスキー���定義"""

from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
import hashlib
import json


# --- 動画関連 ---

class VideoCandidate(BaseModel):
    """DISCOVERで発見された動画候補"""
    video_id: str
    url: str
    title: str
    channel_name: str
    channel_id: str | None = None
    duration_seconds: int = 0
    view_count: int = 0
    upload_date: str | None = None  # YYYYMMDD形式
    description: str = ""
    # CREDIBILITY で付与
    credibility_score: float = 0.0
    channel_trust: float = 0.0
    video_type_score: float = 0.0


class VideoProcessingRecord(BaseModel):
    """処理済み動画の記録（_index.json用）"""
    video_id: str
    url: str
    title: str
    channel_name: str
    status: str = "pending"  # pending | processing | completed | failed | skipped
    credibility_score: float = 0.0
    relevance_score: float = 0.0
    entries_extracted: int = 0
    tokens_used: int = 0
    processing_time_seconds: float = 0.0
    processed_at: str = ""
    skip_reason: str | None = None
    error: str | None = None


# --- ナレッジ ---

class KnowledgeEntry(BaseModel):
    """抽出された個別の攻略知識"""
    id: str = ""  # 自動生成
    category: str  # matchup | combo | neutral | oki | defense | general
    topic: str  # 例: "ケン対ジュリ 画面端の起き攻め"
    content: str  # 具体的なアドバイス
    characters: list[str]  # 関連キャラslug
    matchup: str | None = None  # 対戦相手slug
    situation: str | None = None  # 例: "画面端", "起き攻め"
    source_video_id: str = ""
    source_channel: str = ""
    source_video_title: str = ""
    source_timestamp: str = ""  # "MM:SS"
    source_quote: str = ""  # 元発言引用
    confidence: float = 1.0  # 0.0-1.0
    channel_trust: float = 0.0
    frame_data_conflicts: list[str] = Field(default_factory=list)
    extracted_at: str = ""

    def generate_id(self) -> str:
        """コンテンツベースの決定論的ID生成"""
        content_hash = hashlib.sha256(
            json.dumps({
                "content": self.content,
                "characters": sorted(self.characters),
                "category": self.category,
                "source_video_id": self.source_video_id,
            }, ensure_ascii=False).encode()
        ).hexdigest()[:12]
        self.id = content_hash
        return self.id


class CharacterKnowledge(BaseModel):
    """キャラクター別のナレッジファイル（data/knowledge/{slug}.json）"""
    slug: str
    entries: list[KnowledgeEntry] = Field(default_factory=list)
    last_updated: str = ""
    source_video_count: int = 0


# --- チャンネル ---

class ChannelProfile(BaseModel):
    """チャンネルの信頼性プロファイル"""
    name: str  # "なるお"
    youtube_handle: str = ""  # "@naruo_sf6" 等
    channel_id: str = ""
    trust_rank: str = "B"  # "S" | "A" | "B"
    trust_score: float = 0.3
    subscriber_count: int | None = None
    videos_processed: int = 0
    entries_extracted: int = 0
    avg_knowledge_density: float = 0.0
    last_checked: str = ""
    note: str = ""


# --- カバレッジ ---

class CoverageMatrix(BaseModel):
    """キャラ×カテゴリのカバレッジ情報"""
    # {slug: {category: count}}
    matrix: dict[str, dict[str, int]] = Field(default_factory=dict)
    total_entries: int = 0
    total_videos: int = 0
    gap_queries: list[str] = Field(default_factory=list)
    last_updated: str = ""


# --- インデックス ---

class PipelineIndex(BaseModel):
    """処理済み動画インデックス（_index.json）"""
    version: str = "1"
    last_updated: str = ""
    videos: list[VideoProcessingRecord] = Field(default_factory=list)

    def is_processed(self, video_id: str) -> bool:
        """動画が処理済みか確認"""
        return any(
            v.video_id == video_id and v.status in ("completed", "skipped")
            for v in self.videos
        )

    def add_record(self, record: VideoProcessingRecord) -> None:
        """処理記録を追加（既存があれば更新）"""
        for i, v in enumerate(self.videos):
            if v.video_id == record.video_id:
                self.videos[i] = record
                return
        self.videos.append(record)
        self.last_updated = datetime.now().isoformat()


class DiscoveryQueue(BaseModel):
    """次回処理候補キュー（_discovery_queue.json）"""
    candidates: list[VideoCandidate] = Field(default_factory=list)
    last_updated: str = ""

    def add_candidate(self, candidate: VideoCandidate) -> bool:
        """候補を追加（重複チェック付き）。追加できたらTrue"""
        if any(c.video_id == candidate.video_id for c in self.candidates):
            return False
        self.candidates.append(candidate)
        self.last_updated = datetime.now().isoformat()
        return True
