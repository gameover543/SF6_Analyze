"""Stage 1: CREDIBILITY — 動画の信頼性評価（LLM不使用）

3層フィルタ:
  1. チャンネル信頼度（S/A/B）
  2. 動画種別スコア（タイトル・説明文のキーワード解析）
  3. 再生回数（対数スケール）
"""

import math
import logging

from .schemas import VideoCandidate, ChannelProfile
from .config import (
    TRUSTED_CHANNELS,
    POSITIVE_KEYWORDS,
    NEGATIVE_KEYWORDS,
    CREDIBILITY_WEIGHTS,
    CREDIBILITY_THRESHOLD_HIGH,
    CREDIBILITY_THRESHOLD_LOW,
    AUTO_A_RANK_SUBSCRIBER_THRESHOLD,
)

logger = logging.getLogger(__name__)


class CredibilityScorer:
    """動画の信頼性スコアを算出"""

    def __init__(self, channels: dict[str, ChannelProfile] | None = None):
        # 保存済みチャンネル情報 + 初期信頼チャンネルをマージ
        self.channels: dict[str, ChannelProfile] = channels or {}
        self._init_trusted_channels()

    def _init_trusted_channels(self) -> None:
        """config.pyの信頼チャンネルをプロファイルに初期化"""
        for name, info in TRUSTED_CHANNELS.items():
            if name not in self.channels:
                self.channels[name] = ChannelProfile(
                    name=name,
                    youtube_handle=info.get("handle", ""),
                    trust_rank=info.get("trust_rank", "S"),
                    trust_score=info.get("trust_score", 1.0),
                    note=info.get("note", ""),
                )

    # --- メインAPI ---

    def score(self, candidate: VideoCandidate) -> VideoCandidate:
        """動画候補に信頼性スコアを付与して返す"""
        channel_trust = self._channel_trust(candidate)
        video_type = self._video_type_score(candidate)
        popularity = self._popularity_score(candidate)

        w = CREDIBILITY_WEIGHTS
        total = (
            channel_trust * w["channel_trust"]
            + video_type * w["video_type"]
            + popularity * w["popularity"]
        )

        candidate.channel_trust = channel_trust
        candidate.video_type_score = video_type
        candidate.credibility_score = round(total, 3)

        return candidate

    def score_all(
        self, candidates: list[VideoCandidate]
    ) -> list[VideoCandidate]:
        """全候補にスコアを付与し、閾値でフィルタ"""
        scored = [self.score(c) for c in candidates]

        passed = [
            c for c in scored
            if c.credibility_score >= CREDIBILITY_THRESHOLD_LOW
        ]
        skipped = len(scored) - len(passed)

        if skipped > 0:
            logger.info(
                f"信頼性フィルタ: {len(scored)}件 → {len(passed)}件 "
                f"({skipped}件スキップ, 閾値={CREDIBILITY_THRESHOLD_LOW})"
            )

        # 信頼スコア降順でソート
        passed.sort(key=lambda c: c.credibility_score, reverse=True)
        return passed

    def needs_investigation(self, candidate: VideoCandidate) -> bool:
        """INVESTIGATE段階（Gemini精査）が必要か判定"""
        return candidate.credibility_score < CREDIBILITY_THRESHOLD_HIGH

    # --- スコア算出 ---

    def _channel_trust(self, candidate: VideoCandidate) -> float:
        """チャンネル信頼度を返す (0.0-1.0)"""
        # 名前完全一致でSランク検索
        profile = self.channels.get(candidate.channel_name)
        if profile:
            return profile.trust_score

        # チャンネルIDで検索
        for p in self.channels.values():
            if p.channel_id and p.channel_id == candidate.channel_id:
                return p.trust_score

        # 部分一致で検索（yt-dlpが返す名前が「なるおのひとりでできるもん」等になるため）
        ch_name_lower = candidate.channel_name.lower()
        for name, p in self.channels.items():
            if name.lower() in ch_name_lower or ch_name_lower in name.lower():
                return p.trust_score

        # 未知チャンネル: Bランク（0.3）
        return 0.3

    def _video_type_score(self, candidate: VideoCandidate) -> float:
        """タイトル・説明文からの動画種別スコア (0.0-1.0)"""
        text = f"{candidate.title} {candidate.description}".lower()

        positive_hits = sum(1 for kw in POSITIVE_KEYWORDS if kw.lower() in text)
        negative_hits = sum(1 for kw in NEGATIVE_KEYWORDS if kw.lower() in text)

        # ベーススコア0.5 + ポジティブで加点 - ネガティブで減点
        score = 0.5 + (positive_hits * 0.1) - (negative_hits * 0.15)
        return max(0.0, min(1.0, score))

    def _popularity_score(self, candidate: VideoCandidate) -> float:
        """再生回数の対数スケールスコア (0.0-1.0)

        1,000回 → 0.3, 10,000回 → 0.5, 100,000回 → 0.7, 1,000,000回 → 0.9
        """
        if candidate.view_count <= 0:
            return 0.3  # 再生回数不明の場合はデフォルト
        log_views = math.log10(max(candidate.view_count, 1))
        # log10(1000)=3 → 0.3, log10(1M)=6 → 0.9
        return max(0.0, min(1.0, log_views / 6.67))

    # --- チャンネル学習 ---

    def register_channel(
        self, name: str, channel_id: str = "", handle: str = "",
        rank: str = "B", score: float = 0.3
    ) -> ChannelProfile:
        """新しいチャンネルを登録"""
        if name in self.channels:
            return self.channels[name]

        profile = ChannelProfile(
            name=name,
            youtube_handle=handle,
            channel_id=channel_id,
            trust_rank=rank,
            trust_score=score,
        )
        self.channels[name] = profile
        logger.info(f"チャンネル登録: {name} (ランク{rank}, スコア{score})")
        return profile

    def update_channel_stats(
        self, name: str, entries_extracted: int, knowledge_density: float
    ) -> None:
        """動画処理後にチャンネル統計を更新"""
        profile = self.channels.get(name)
        if not profile:
            return

        profile.videos_processed += 1
        profile.entries_extracted += entries_extracted

        # 移動平均で知識密度を更新
        n = profile.videos_processed
        profile.avg_knowledge_density = (
            profile.avg_knowledge_density * (n - 1) + knowledge_density
        ) / n
