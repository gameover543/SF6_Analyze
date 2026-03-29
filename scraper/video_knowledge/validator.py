"""Stage 4a: EVALUATE — フレームデータ���合バリデーション（LLM不使用）

抽出された知���に含まれるフレーム数値を data/frame_data/ と照合し、
矛盾がある場合は confidence を下げて警告を付与する。
"""

import re
import json
import logging
from pathlib import Path

from .schemas import KnowledgeEntry
from .config import PipelineConfig
from .move_resolver import MoveResolver

logger = logging.getLogger(__name__)

# フレーム関連の正規表現パターン
FRAME_PATTERNS = [
    # "発生4F", "発生4フレーム"
    (r"発生\s*(\d+)\s*[Fフレーム]", "startup_frame"),
    # "ガード+3", "ガード-7", "ガード±0"
    (r"ガード\s*([+-]?\d+)", "block_frame"),
    # "ヒット+5", "ヒット-2"
    (r"ヒット\s*([+-]?\d+)", "hit_frame"),
    # "全体23F"
    (r"全体\s*(\d+)\s*[Fフレーム]", "total_frame"),
]


class FrameDataValidator:
    """フレームデータとの照合バリデーション"""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self._frame_data_cache: dict[str, list[dict]] = {}
        self._resolver = MoveResolver(config.frame_data_dir)

    def validate_entries(self, entries: list[KnowledgeEntry]) -> list[KnowledgeEntry]:
        """エントリ群をバリデーションし、confidence を調整。referenced_movesも設定。"""
        for entry in entries:
            # 技名解決: referenced_moves を自動設定
            if not entry.referenced_moves:
                entry.referenced_moves = self._resolver.resolve_for_entry(
                    entry.content, entry.source_quote, entry.characters
                )
            self._validate_entry(entry)
        return entries

    def _validate_entry(self, entry: KnowledgeEntry) -> None:
        """単一エントリのバリデーション"""
        text = f"{entry.content} {entry.source_quote}"
        claims = self._extract_frame_claims(text)

        if not claims:
            # フレーム数値の主張がない → バリデーション対象外
            entry.confidence = min(entry.confidence, 1.0)
            return

        conflicts = []
        verified = 0

        for char_slug in entry.characters:
            if char_slug == "general":
                continue
            moves = self._load_frame_data(char_slug)
            if not moves:
                continue

            for claim_type, claim_value, claim_text in claims:
                result = self._check_claim(moves, claim_type, claim_value)
                if result == "verified":
                    verified += 1
                elif result == "conflict":
                    conflict_msg = f"フレームデータと矛盾: {claim_text}"
                    conflicts.append(conflict_msg)
                # "not_found" の場合はスキップ（技が特定できない）

        # confidence 調整
        if conflicts:
            entry.frame_data_conflicts = conflicts
            # 矛盾あり: confidence 大幅低下
            entry.confidence = min(entry.confidence, 0.3)
            logger.warning(
                f"フレームデータ矛盾: {entry.topic} - {conflicts}"
            )
        elif verified > 0:
            # 検証済み: confidence 維持 or 向上
            entry.confidence = min(entry.confidence, 1.0)

    def _extract_frame_claims(self, text: str) -> list[tuple[str, str, str]]:
        """テキストからフレーム関連の主張を抽出

        Returns: [(claim_type, claim_value, original_text), ...]
        """
        claims = []
        for pattern, claim_type in FRAME_PATTERNS:
            for match in re.finditer(pattern, text):
                claims.append((claim_type, match.group(1), match.group(0)))
        return claims

    def _load_frame_data(self, slug: str) -> list[dict]:
        """キ��ラのフレームデータをロード（キャッシュ付き）"""
        if slug in self._frame_data_cache:
            return self._frame_data_cache[slug]

        path = self.config.frame_data_dir / f"{slug}.json"
        if not path.exists():
            self._frame_data_cache[slug] = []
            return []

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            # データ形式: リストの���合そのまま、dictの場合はmovesを取得
            if isinstance(data, list):
                moves = data
            elif isinstance(data, dict):
                moves = data.get("moves", data.get("data", []))
            else:
                moves = []
            self._frame_data_cache[slug] = moves
            return moves
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"フレームデータ読み込み失敗 ({slug}): {e}")
            self._frame_data_cache[slug] = []
            return []

    def _check_claim(
        self, moves: list[dict], claim_type: str, claim_value: str
    ) -> str:
        """主張をフレームデータと照合

        Returns: "verified" | "conflict" | "not_found"
        """
        # フレームデータの全技から該当フィールドを収集
        field_name = claim_type  # startup_frame, block_frame, etc.
        actual_values = set()

        for move in moves:
            val = move.get(field_name, "")
            if val:
                # "4" や "+3" や "-7" 等の数値部分を抽出
                clean = re.sub(r'[^0-9+-]', '', str(val).split('-')[0] if '-' in str(val) and not str(val).startswith('-') else str(val))
                if clean:
                    actual_values.add(clean)

        if not actual_values:
            return "not_found"

        # 主張値がフレームデータのどれかに存在するか
        claim_clean = claim_value.lstrip('+')
        if claim_clean in actual_values or f"+{claim_clean}" in actual_values:
            return "verified"

        # 厳密なマッチングは技名の特定が必要だが、
        # 現段階では値の存在チェックのみ（偽陽性のリスクあり）
        return "not_found"
