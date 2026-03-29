"""Stage 2: INVESTIGATE — Gemini APIによる動画内容の精査"""

import json
import logging
from dataclasses import dataclass

from .schemas import VideoCandidate
from .prompts import INVESTIGATE_PROMPT
from .budget import BudgetTracker
from .config import PipelineConfig

logger = logging.getLogger(__name__)


@dataclass
class InvestigationResult:
    """INVESTIGATE の結果"""
    is_tutorial: bool = False
    knowledge_density: float = 0.0
    characters: list[str] = None
    topics: list[str] = None
    summary: str = ""
    passed: bool = False  # EXECUTE に進むべきか
    error: str | None = None

    def __post_init__(self):
        if self.characters is None:
            self.characters = []
        if self.topics is None:
            self.topics = []


class VideoInvestigator:
    """Gemini APIで動画の内容を精査し、解説動画かどうか判定"""

    def __init__(self, config: PipelineConfig, budget: BudgetTracker):
        self.config = config
        self.budget = budget
        self._client = None

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

    def investigate(self, candidate: VideoCandidate, max_retries: int = 3) -> InvestigationResult:
        """動画を精査して解説動画かどうか判定（429エラー時はリトライ）"""
        if not self.budget.can_process(candidate.duration_seconds):
            return InvestigationResult(
                error="予算上限到達", passed=False
            )

        import time

        for attempt in range(max_retries):
            self.budget.wait_for_rate_limit()

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
                        INVESTIGATE_PROMPT,
                    ],
                )

                self.budget.record_request(candidate.duration_seconds)
                break  # 成功

            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    wait = 60 * (attempt + 1)
                    logger.warning(
                        f"レート制限 (試行{attempt+1}/{max_retries})。{wait}秒待機... "
                        f"({candidate.video_id})"
                    )
                    time.sleep(wait)
                    if attempt == max_retries - 1:
                        return InvestigationResult(
                            error="レート制限（リトライ上限）", passed=False
                        )
                    continue
                else:
                    logger.error(f"INVESTIGATE失敗 ({candidate.video_id}): {e}")
                    return InvestigationResult(error=str(e), passed=False)

            # レスポンスからJSONを抽出
            result_data = self._parse_json_response(response.text)
            if result_data is None:
                return InvestigationResult(
                    error="JSONパース失敗", passed=False
                )

            is_tutorial = result_data.get("is_tutorial", False)
            knowledge_density = float(result_data.get("knowledge_density", 0))
            characters = result_data.get("characters", [])
            topics = result_data.get("topics", [])
            summary = result_data.get("summary", "")

            # 通過判定
            passed = is_tutorial and knowledge_density >= self.config.min_knowledge_density

            logger.info(
                f"INVESTIGATE: {'✅ 通過' if passed else '❌ スキップ'} "
                f"[tutorial={is_tutorial}, density={knowledge_density:.1f}] "
                f"{candidate.title[:40]}"
            )

            return InvestigationResult(
                is_tutorial=is_tutorial,
                knowledge_density=knowledge_density,
                characters=characters,
                topics=topics,
                summary=summary,
                passed=passed,
            )

        except Exception as e:
            logger.error(f"INVESTIGATE失敗 ({candidate.video_id}): {e}")
            return InvestigationResult(error=str(e), passed=False)

    def _parse_json_response(self, text: str) -> dict | None:
        """GeminiのレスポンスからJSON部分を抽出"""
        # コードブロック内のJSONを探す
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.index("```") + 3
            end = text.index("```", start)
            text = text[start:end].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # JSON部分を正規表現で探す
            import re
            match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            logger.error(f"JSONパース失敗: {text[:200]}")
            return None
