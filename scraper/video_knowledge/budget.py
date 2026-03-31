"""レートリミット・日次予算管理

動画の長さに応じた動的な待ち時間で、429エラーを根本的に防止する。
Gemini APIは動画のトークン数が大きい（20分動画≈100-200Kトークン）ため、
固定5秒間隔ではトークン/分の制限に引っかかる。
"""

import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# 動画1分あたりの推定トークン数（映像1fps + 音声）
TOKENS_PER_VIDEO_MINUTE = 8_000

# Vertex AI Gemini 2.5 Flash のトークン/分制限（有料枠）
# 実測値ベース: 250K tok/min で429が出たので、余裕を持って設定
TARGET_TOKENS_PER_MINUTE = 200_000


@dataclass
class BudgetTracker:
    """API呼び出しの予算とレートリミットを管理"""

    # 日次制限
    daily_request_limit: int = 1000
    daily_video_minutes: int = 480  # 8時間

    # RPM制限（最低待ち時間）
    min_interval_sec: float = 5.0

    # 現在の消費量
    requests_used: int = 0
    video_minutes_used: float = 0.0
    _last_request_time: float = field(default=0.0, repr=False)
    _last_video_duration: int = field(default=0, repr=False)

    def can_process(self, video_duration_sec: int = 0) -> bool:
        """次の動画を処理できるか確認"""
        if self.requests_used >= self.daily_request_limit:
            logger.warning(
                f"日次リクエスト上限到達: {self.requests_used}/{self.daily_request_limit}"
            )
            return False

        video_minutes = video_duration_sec / 60
        estimated_minutes = video_minutes * 2
        if self.video_minutes_used + estimated_minutes > self.daily_video_minutes:
            logger.warning(
                f"日次動画時間上限到達: {self.video_minutes_used:.1f}/{self.daily_video_minutes}分"
            )
            return False

        return True

    def wait_for_rate_limit(self, video_duration_sec: int = 0) -> None:
        """動画の長さに応じた動的な待ち時間でレートリミットを回避

        20分動画 → 約200Kトークン → 200K/200K = 1分は次のリクエストを待つべき
        5分動画 → 約40Kトークン → 40K/200K = 12秒待てばOK
        """
        if self._last_request_time <= 0:
            return

        # 前回の動画の長さベースで待ち時間を計算
        last_duration = self._last_video_duration or video_duration_sec
        if last_duration > 0:
            estimated_tokens = last_duration / 60 * TOKENS_PER_VIDEO_MINUTE
            # トークン/分制限から必要な待ち時間を算出
            required_wait = estimated_tokens / TARGET_TOKENS_PER_MINUTE * 60
        else:
            required_wait = self.min_interval_sec

        # 最低待ち時間を保証
        required_wait = max(required_wait, self.min_interval_sec)

        elapsed = time.time() - self._last_request_time
        wait_time = required_wait - elapsed

        if wait_time > 0:
            logger.debug(
                f"レートリミット待機: {wait_time:.1f}秒 "
                f"(動画{last_duration//60}分→{required_wait:.0f}秒間隔)"
            )
            time.sleep(wait_time)

    def record_request(self, video_duration_sec: int = 0) -> None:
        """API呼び出しを記録"""
        self.requests_used += 1
        self.video_minutes_used += video_duration_sec / 60
        self._last_request_time = time.time()
        self._last_video_duration = video_duration_sec
        logger.debug(
            f"API使用: {self.requests_used}回, "
            f"動画時間: {self.video_minutes_used:.1f}分"
        )

    def summary(self) -> str:
        """予算使用状況のサマリー"""
        return (
            f"リクエスト: {self.requests_used}/{self.daily_request_limit}, "
            f"動画時間: {self.video_minutes_used:.1f}/{self.daily_video_minutes}分"
        )
