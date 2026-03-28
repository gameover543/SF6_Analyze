"""レートリミット・日次予算管理

Gemini 2.5 Flash 無料枠:
- 1,500 リクエスト/日
- 15 RPM
- 動画処理: 1日8時間分
"""

import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class BudgetTracker:
    """API呼び出しの予算とレートリミットを管理"""

    # 日次制限
    daily_request_limit: int = 1000
    daily_video_minutes: int = 480  # 8時間

    # RPM制限
    request_interval_sec: float = 5.0

    # 現在の消費量
    requests_used: int = 0
    video_minutes_used: float = 0.0
    _last_request_time: float = field(default=0.0, repr=False)

    def can_process(self, video_duration_sec: int = 0) -> bool:
        """次の動画を処理できるか確認"""
        if self.requests_used >= self.daily_request_limit:
            logger.warning(
                f"日次リクエスト上限到達: {self.requests_used}/{self.daily_request_limit}"
            )
            return False

        video_minutes = video_duration_sec / 60
        # INVESTIGATE + EXECUTE で2回分の動画時間を消費する可能性
        estimated_minutes = video_minutes * 2
        if self.video_minutes_used + estimated_minutes > self.daily_video_minutes:
            logger.warning(
                f"日次動画時間上限到達: {self.video_minutes_used:.1f}/{self.daily_video_minutes}分"
            )
            return False

        return True

    def wait_for_rate_limit(self) -> None:
        """RPM制限を守るために必要な待ち時間をスリープ"""
        if self._last_request_time > 0:
            elapsed = time.time() - self._last_request_time
            wait_time = self.request_interval_sec - elapsed
            if wait_time > 0:
                logger.debug(f"レートリミット待機: {wait_time:.1f}秒")
                time.sleep(wait_time)

    def record_request(self, video_duration_sec: int = 0) -> None:
        """API呼び出しを記録"""
        self.requests_used += 1
        self.video_minutes_used += video_duration_sec / 60
        self._last_request_time = time.time()
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
