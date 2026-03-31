"""Stage 3: EXECUTE — Gemini APIによる構造化知識の抽出"""

import json
import logging
from datetime import datetime

from .schemas import VideoCandidate, KnowledgeEntry
from .prompts import EXTRACTION_PROMPT
from .budget import BudgetTracker
from .config import PipelineConfig, CHARACTER_JP_NAMES
from .move_resolver import MoveResolver

logger = logging.getLogger(__name__)

# 有効なキャラslugの集合
VALID_SLUGS = set(CHARACTER_JP_NAMES.keys())


class KnowledgeExtractor:
    """Gemini APIで動画から構造化された攻略知識を抽出"""

    def __init__(self, config: PipelineConfig, budget: BudgetTracker):
        self.config = config
        self.budget = budget
        self._client = None
        self._resolver = MoveResolver(config.frame_data_dir)

    def _get_client(self):
        """Gemini APIクライアントを遅延初期化（Vertex AI / AI Studio 自動切替）"""
        if self._client is None:
            from google import genai
            if self.config.use_vertex_ai:
                self._client = genai.Client(
                    vertexai=True,
                    project=self.config.vertex_project,
                    location=self.config.vertex_location,
                )
            else:
                self._client = genai.Client(api_key=self.config.google_api_key)
        return self._client

    def extract(self, candidate: VideoCandidate, max_retries: int = 3) -> list[KnowledgeEntry]:
        """動画から攻略知識を抽出（429エラー時はリトライ、動的待ち時間）"""
        if not self.budget.can_process(candidate.duration_seconds):
            logger.warning("予算上限到達。抽出をスキップ。")
            return []

        import time
        import re

        response = None
        for attempt in range(max_retries):
            self.budget.wait_for_rate_limit(candidate.duration_seconds)

            try:
                client = self._get_client()
                from google.genai import types

                response = client.models.generate_content(
                    model=self.config.gemini_model,
                    contents=[
                        types.Part(
                            file_data=types.FileData(
                                file_uri=f"https://www.youtube.com/watch?v={candidate.video_id}",
                                mime_type="video/*",
                            )
                        ),
                        EXTRACTION_PROMPT,
                    ],
                )

                self.budget.record_request(candidate.duration_seconds)
                break  # 成功

            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    # レスポンスからretryDelay値を抽出（あれば）
                    retry_match = re.search(r"retryDelay.*?(\d+)", err_str)
                    wait = int(retry_match.group(1)) + 5 if retry_match else 60 * (attempt + 1)
                    logger.warning(
                        f"レート制限 (試行{attempt+1}/{max_retries})。{wait}秒待機... "
                        f"({candidate.video_id})"
                    )
                    time.sleep(wait)
                    if attempt == max_retries - 1:
                        logger.error(f"EXECUTE失敗（リトライ上限）: {candidate.video_id}")
                        return []
                elif "400" in err_str or "INVALID_ARGUMENT" in err_str:
                    # 非公開/削除済み動画等 → リトライしても無駄
                    logger.error(f"EXECUTE失敗（無効な動画）: {candidate.video_id}")
                    return []
                else:
                    logger.error(f"EXECUTE失敗 ({candidate.video_id}): {e}")
                    return []

        if response is None:
            return []

        # レスポンスからJSON配列を抽出
        try:
            entries_data = self._parse_json_array(response.text)
        except Exception as e:
            logger.error(f"JSONパース例外 ({candidate.video_id}): {e}")
            return []

        if entries_data is None:
            logger.error(f"知識抽出のJSONパース失敗: {candidate.video_id}")
            return []

        # KnowledgeEntry に変換
        entries = self._convert_entries(entries_data, candidate)
        logger.info(
            f"EXECUTE: {len(entries)}件の知識を抽出 - {candidate.title[:40]}"
        )
        return entries

    def _convert_entries(
        self, raw_entries: list[dict], candidate: VideoCandidate
    ) -> list[KnowledgeEntry]:
        """生のJSON配列をKnowledgeEntryリストに変換・検証"""
        entries = []
        now = datetime.now().isoformat()

        for raw in raw_entries:
            if not isinstance(raw, dict):
                continue

            # 必須フィールドのチェック
            content = str(raw.get("content", "")).strip()
            if not content:
                continue

            characters = raw.get("characters", [])
            # LLMがネストされたリストを返す場合の防御（[["jamie"]]→["jamie"]）
            if characters and isinstance(characters[0], list):
                characters = [s for sublist in characters for s in sublist]
            # slugの検証: 不正なslugを除外（文字列以外も除外）
            characters = [s for s in characters if isinstance(s, str) and s in VALID_SLUGS]
            if not characters:
                # キャラ指定なしの一般知識も許容
                characters = ["general"]

            # カテゴリの検証
            category = raw.get("category", "general")
            if category not in ("matchup", "combo", "neutral", "oki", "defense", "general"):
                category = "general"

            # マッチアップslugの検証
            matchup = raw.get("matchup")
            if matchup and matchup not in VALID_SLUGS:
                matchup = None

            # 技名解決: LLMが出力したreferenced_move_namesをweb_idに変換
            move_names = raw.get("referenced_move_names", [])
            referenced_moves = self._resolver.resolve_for_entry(
                content, raw.get("source_quote", ""), characters
            )

            entry = KnowledgeEntry(
                category=category,
                topic=raw.get("topic", "")[:50],
                content=content,
                characters=characters,
                matchup=matchup,
                situation=raw.get("situation"),
                source_video_id=candidate.video_id,
                source_channel=candidate.channel_name,
                source_video_title=candidate.title,
                source_timestamp=raw.get("source_timestamp", ""),
                source_quote=raw.get("source_quote", ""),
                confidence=1.0,  # バリデーション後に調整
                channel_trust=candidate.channel_trust,
                extracted_at=now,
                # パッチ鮮度管理フィールド
                game_version=self._resolver.get_game_version(),
                video_upload_date=candidate.upload_date or "",
                referenced_moves=referenced_moves,
            )
            entry.generate_id()
            entries.append(entry)

        return entries

    def _parse_json_array(self, text: str) -> list[dict] | None:
        """GeminiのレスポンスからJSON配列を抽出"""
        # コードブロック内を探す
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.index("```") + 3
            end = text.index("```", start)
            text = text[start:end].strip()

        try:
            result = json.loads(text)
            if isinstance(result, list):
                return result
            return None
        except json.JSONDecodeError:
            # [ ... ] 部分を探す
            import re
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group())
                    if isinstance(result, list):
                        return result
                except json.JSONDecodeError:
                    pass
            logger.error(f"JSON配列パース失敗: {text[:300]}")
            return None
