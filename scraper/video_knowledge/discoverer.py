"""Stage 0: DISCOVER — yt-dlpによる動画発見（チャンネル巡回 + キーワード検索）"""

import json
import subprocess
import re
import logging
import shutil
import sys
from pathlib import Path
from typing import Iterator

from .schemas import VideoCandidate
from .config import (
    PipelineConfig,
    TRUSTED_CHANNELS,
    CHARACTER_JP_NAMES,
    SEARCH_QUERY_TEMPLATES,
    COACHING_QUERY_TEMPLATES,
    EXCLUDE_PATTERNS,
)

logger = logging.getLogger(__name__)


class VideoDiscoverer:
    """yt-dlpを使った動画発見"""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self._exclude_re = [re.compile(p) for p in EXCLUDE_PATTERNS]
        # yt-dlpのパスを解決（venv内を優先）
        self._ytdlp = self._find_ytdlp()

    @staticmethod
    def _find_ytdlp() -> str:
        """yt-dlpの実行パスを探す"""
        # 現在のPythonと同じvenv内を最優先
        venv_bin = Path(sys.executable).parent / "yt-dlp"
        if venv_bin.exists():
            return str(venv_bin)
        # PATHから探す
        found = shutil.which("yt-dlp")
        if found:
            return found
        return "yt-dlp"  # フォールバック（見つからなければエラーになる）

    # --- メインAPI ---

    def discover_from_channels(
        self, channel_handles: dict[str, str] | None = None
    ) -> list[VideoCandidate]:
        """信頼チャンネルの動画一覧を取得

        Args:
            channel_handles: {チャンネル名: YouTubeハンドルまたはURL} の辞書
                指定しない場合はTRUSTED_CHANNELSから取得
        """
        if channel_handles is None:
            channel_handles = {
                name: info.get("handle", "")
                for name, info in TRUSTED_CHANNELS.items()
                if info.get("handle")
            }

        candidates = []
        for name, handle in channel_handles.items():
            if not handle:
                logger.warning(f"チャンネル '{name}' のハンドルが未設定。スキップ。")
                continue
            logger.info(f"チャンネル巡回: {name} ({handle})")
            url = handle if handle.startswith("http") else f"https://www.youtube.com/{handle}/videos"
            videos = list(self._fetch_playlist(url, channel_name=name))
            candidates.extend(videos)
            logger.info(f"  → {len(videos)}件の動画を発見")

        return candidates

    def discover_from_search(
        self,
        queries: list[str] | None = None,
        target_characters: list[str] | None = None,
    ) -> list[VideoCandidate]:
        """キーワード検索で動画を発見

        Args:
            queries: 検索クエリのリスト。Noneの場合は自動生成
            target_characters: 対象キャラslug。Noneの場合は全キャラ
        """
        if queries is None:
            queries = self._generate_search_queries(target_characters)

        candidates = []
        seen_ids = set()

        for query in queries:
            logger.info(f"検索: {query}")
            search_url = f"ytsearch{self.config.search_results_per_query}:{query}"
            for video in self._fetch_playlist(search_url):
                if video.video_id not in seen_ids:
                    seen_ids.add(video.video_id)
                    candidates.append(video)

            logger.info(f"  → 累計 {len(candidates)}件（重複除外済み）")

        return candidates

    def discover_from_urls(self, urls: list[str]) -> list[VideoCandidate]:
        """指定URLリストから動画情報を取得"""
        candidates = []
        for url in urls:
            video_id = self._extract_video_id(url)
            if not video_id:
                logger.warning(f"動画IDを抽出できません: {url}")
                continue

            metadata = self._fetch_video_metadata(url)
            if metadata:
                candidates.append(metadata)

        return candidates

    # --- メタデータフィルタ ---

    def filter_candidates(
        self, candidates: list[VideoCandidate], processed_ids: set[str]
    ) -> list[VideoCandidate]:
        """メタデータベースのフィルタリング（LLM不使用）"""
        filtered = []
        for c in candidates:
            # 処理済みスキップ
            if c.video_id in processed_ids:
                continue

            # 再生時間フィルタ
            if c.duration_seconds < self.config.min_duration_sec:
                logger.debug(f"短すぎ({c.duration_seconds}秒): {c.title}")
                continue
            if c.duration_seconds > self.config.max_duration_sec:
                logger.debug(f"長すぎ({c.duration_seconds}秒): {c.title}")
                continue

            # 除外パターン
            if self._matches_exclude(c.title):
                logger.debug(f"除外パターン該当: {c.title}")
                continue

            filtered.append(c)

        logger.info(
            f"メタデータフィルタ: {len(candidates)}件 → {len(filtered)}件"
        )
        return filtered

    # --- 内部メソッド ---

    def _generate_search_queries(
        self, target_characters: list[str] | None = None
    ) -> list[str]:
        """キャラ名を埋め込んだ検索クエリを生成"""
        queries = []
        chars = target_characters or list(CHARACTER_JP_NAMES.keys())

        for slug in chars:
            char_jp = CHARACTER_JP_NAMES.get(slug, slug)
            for template in SEARCH_QUERY_TEMPLATES:
                if "{opponent_jp}" in template:
                    continue
                query = template.format(char_jp=char_jp)
                queries.append(query)

        # コーチング動画クエリを追加
        for template in COACHING_QUERY_TEMPLATES:
            if "{char_jp}" in template:
                for slug in chars[:5]:  # 主要キャラのみ
                    query = template.format(char_jp=CHARACTER_JP_NAMES.get(slug, slug))
                    queries.append(query)
            else:
                queries.append(template)

        return queries

    def _fetch_playlist(
        self, url: str, channel_name: str = ""
    ) -> Iterator[VideoCandidate]:
        """yt-dlpでプレイリスト/検索結果からメタデータを取得"""
        cmd = [
            self._ytdlp,
            "--flat-playlist",
            "--dump-json",
            "--no-warnings",
            "--ignore-errors",
            url,
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            logger.error(f"yt-dlpタイムアウト: {url}")
            return
        except FileNotFoundError:
            logger.error("yt-dlpがインストールされていません。pip install yt-dlp を実行してください。")
            return

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            video_id = data.get("id", "")
            if not video_id:
                continue

            yield VideoCandidate(
                video_id=video_id,
                url=data.get("url", f"https://www.youtube.com/watch?v={video_id}"),
                title=data.get("title", ""),
                channel_name=channel_name or data.get("channel", data.get("uploader", "")),
                channel_id=data.get("channel_id", ""),
                duration_seconds=int(data.get("duration", 0) or 0),
                view_count=int(data.get("view_count", 0) or 0),
                upload_date=data.get("upload_date", ""),
                description=(data.get("description") or "")[:500],
            )

    def _fetch_video_metadata(self, url: str) -> VideoCandidate | None:
        """単一動画のメタデータを取得"""
        cmd = [
            self._ytdlp,
            "--dump-json",
            "--no-warnings",
            "--skip-download",
            url,
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                logger.error(f"yt-dlpエラー: {result.stderr[:200]}")
                return None

            data = json.loads(result.stdout)
            return VideoCandidate(
                video_id=data.get("id", ""),
                url=url,
                title=data.get("title", ""),
                channel_name=data.get("channel", data.get("uploader", "")),
                channel_id=data.get("channel_id", ""),
                duration_seconds=int(data.get("duration", 0) or 0),
                view_count=int(data.get("view_count", 0) or 0),
                upload_date=data.get("upload_date", ""),
                description=(data.get("description") or "")[:500],
            )
        except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
            logger.error(f"メタデータ取得失敗 ({url}): {e}")
            return None

    def _matches_exclude(self, text: str) -> bool:
        """除外パターンにマッチするか"""
        return any(p.search(text) for p in self._exclude_re)

    @staticmethod
    def _extract_video_id(url: str) -> str | None:
        """URLからYouTube動画IDを抽出"""
        patterns = [
            r"(?:v=|/v/)([a-zA-Z0-9_-]{11})",
            r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
