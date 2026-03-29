"""Stage 1: CREDIBILITY — 動画の信頼性評価（LLM不使用）

設計方針:
  - 「良いチャンネルの動画だから取り込む」ではなく「講座動画だから取り込む」
  - チャンネル信頼度はボーナスであって、講座判定の代替ではない
  - Sランクチャンネルでも、講座でない動画（ティアリスト、配信、ネタ等）は弾く

スコアリング:
  1. 講座判定（TUTORIAL_INDICATORS の有無）→ 0なら即スキップ
  2. 強制除外（HARD_EXCLUDE_KEYWORDS）→ 該当したら即スキップ
  3. 動画種別スコア = 講座指標の密度 - 減点キーワード
  4. 総合スコア = チャンネル信頼度(0.35) + 動画種別(0.45) + 再生回数(0.20)
"""

import math
import logging
import re

from .schemas import VideoCandidate, ChannelProfile
from .config import (
    TRUSTED_CHANNELS,
    TUTORIAL_INDICATORS,
    HARD_EXCLUDE_KEYWORDS,
    SOFT_NEGATIVE_KEYWORDS,
    EXCLUDE_PATTERNS,
    CREDIBILITY_WEIGHTS,
    CREDIBILITY_THRESHOLD_HIGH,
    CREDIBILITY_THRESHOLD_LOW,
    VIDEO_TYPE_MINIMUM,
)

logger = logging.getLogger(__name__)

# 除外パターンをプリコンパイル
_EXCLUDE_RE = [re.compile(p, re.IGNORECASE) for p in EXCLUDE_PATTERNS]


class CredibilityScorer:
    """動画の信頼性スコアを算出"""

    def __init__(self, channels: dict[str, ChannelProfile] | None = None):
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
        text = f"{candidate.title} {candidate.description}"

        # Step 1: 除外パターンチェック（チャンネルランク問わず即除外）
        if self._matches_exclude_pattern(text):
            candidate.credibility_score = 0.0
            candidate.video_type_score = 0.0
            candidate.channel_trust = self._channel_trust(candidate)
            return candidate

        # Step 2: 強制除外キーワードチェック
        if self._has_hard_exclude(text):
            candidate.credibility_score = 0.0
            candidate.video_type_score = 0.0
            candidate.channel_trust = self._channel_trust(candidate)
            return candidate

        # Step 3: 講座指標チェック（1つもなければ講座ではない → 不通過）
        tutorial_count = self._count_tutorial_indicators(text)
        if tutorial_count == 0:
            candidate.credibility_score = 0.0
            candidate.video_type_score = 0.0
            candidate.channel_trust = self._channel_trust(candidate)
            return candidate

        # Step 4: スコア算出
        channel_trust = self._channel_trust(candidate)
        video_type = self._video_type_score(text, tutorial_count)
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
        """全候補にスコアを付与し、フィルタリング"""
        scored = [self.score(c) for c in candidates]

        passed = []
        skipped_reasons = {"除外パターン/キーワード": 0, "講座指標なし": 0, "スコア不足": 0}

        for c in scored:
            # 動画種別スコアの最低ライン（チャンネルランク問わず）
            if c.video_type_score < VIDEO_TYPE_MINIMUM:
                if c.video_type_score == 0.0:
                    # 除外パターン or 講座指標なし（score()で0にされたもの）
                    if self._has_hard_exclude(f"{c.title} {c.description}"):
                        skipped_reasons["除外パターン/キーワード"] += 1
                    else:
                        skipped_reasons["講座指標なし"] += 1
                else:
                    skipped_reasons["スコア不足"] += 1
                continue

            if c.credibility_score < CREDIBILITY_THRESHOLD_LOW:
                skipped_reasons["スコア不足"] += 1
                continue

            passed.append(c)

        total_skipped = len(scored) - len(passed)
        if total_skipped > 0:
            reasons_str = ", ".join(
                f"{k}:{v}" for k, v in skipped_reasons.items() if v > 0
            )
            logger.info(
                f"信頼性フィルタ: {len(scored)}件 → {len(passed)}件 "
                f"({total_skipped}件除外: {reasons_str})"
            )

        passed.sort(key=lambda c: c.credibility_score, reverse=True)
        return passed

    def needs_investigation(self, candidate: VideoCandidate) -> bool:
        """INVESTIGATE段階（Gemini精査）が必要か判定"""
        return candidate.credibility_score < CREDIBILITY_THRESHOLD_HIGH

    # --- 判定ロジック ---

    @staticmethod
    def _matches_exclude_pattern(text: str) -> bool:
        """除外パターン（正規表現）にマッチするか"""
        return any(p.search(text) for p in _EXCLUDE_RE)

    @staticmethod
    def _has_hard_exclude(text: str) -> bool:
        """強制除外キーワードが含まれるか"""
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in HARD_EXCLUDE_KEYWORDS)

    @staticmethod
    def _count_tutorial_indicators(text: str) -> int:
        """講座指標キーワードの一致数を返す"""
        text_lower = text.lower()
        return sum(1 for kw in TUTORIAL_INDICATORS if kw.lower() in text_lower)

    # --- スコア算出 ---

    def _channel_trust(self, candidate: VideoCandidate) -> float:
        """チャンネル信頼度を返す (0.0-1.0)"""
        profile = self.channels.get(candidate.channel_name)
        if profile:
            return profile.trust_score

        for p in self.channels.values():
            if p.channel_id and p.channel_id == candidate.channel_id:
                return p.trust_score

        # 部分一致（yt-dlpのチャンネル名が正式名と異なるケース対応）
        ch_name_lower = candidate.channel_name.lower()
        for name, p in self.channels.items():
            if name.lower() in ch_name_lower or ch_name_lower in name.lower():
                return p.trust_score

        return 0.3  # 未知チャンネル

    @staticmethod
    def _video_type_score(text: str, tutorial_count: int) -> float:
        """動画種別スコア (0.0-1.0)

        講座指標の密度を基本スコアとし、減点キーワードで減算。
        ベースは0.3（講座指標1個）から始まり、指標が多いほど上がる。
        """
        text_lower = text.lower()

        # 講座指標: 1個→0.4, 2個→0.55, 3個→0.7, 4個以上→0.8
        base = min(0.8, 0.25 + tutorial_count * 0.15)

        # 弱い減点キーワード
        soft_neg = sum(1 for kw in SOFT_NEGATIVE_KEYWORDS if kw.lower() in text_lower)
        penalty = soft_neg * 0.1

        return max(0.0, min(1.0, base - penalty))

    @staticmethod
    def _popularity_score(candidate: VideoCandidate) -> float:
        """再生回数の対数スケールスコア (0.0-1.0)"""
        if candidate.view_count <= 0:
            return 0.3
        log_views = math.log10(max(candidate.view_count, 1))
        return max(0.0, min(1.0, log_views / 6.67))

    # --- チャンネル管理 ---

    def register_channel(
        self, name: str, channel_id: str = "", handle: str = "",
        rank: str = "B", score: float = 0.3
    ) -> ChannelProfile:
        if name in self.channels:
            return self.channels[name]
        profile = ChannelProfile(
            name=name, youtube_handle=handle, channel_id=channel_id,
            trust_rank=rank, trust_score=score,
        )
        self.channels[name] = profile
        logger.info(f"チャンネル登録: {name} (ランク{rank}, スコア{score})")
        return profile

    def update_channel_stats(
        self, name: str, entries_extracted: int, knowledge_density: float
    ) -> None:
        profile = self.channels.get(name)
        if not profile:
            return
        profile.videos_processed += 1
        profile.entries_extracted += entries_extracted
        n = profile.videos_processed
        profile.avg_knowledge_density = (
            profile.avg_knowledge_density * (n - 1) + knowledge_density
        ) / n
