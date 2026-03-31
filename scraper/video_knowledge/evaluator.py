"""Stage 4b: EVALUATE — 重複排除・カバレッジ分析・ギャップクエリ生成（LLM不使用）"""

import logging
from collections import defaultdict

from .schemas import KnowledgeEntry, CoverageMatrix
from .config import (
    CHARACTER_JP_NAMES,
    CATEGORY_JP_NAMES,
    GAP_QUERY_TEMPLATES,
)
from .sources import DataStore

logger = logging.getLogger(__name__)

# カバレッジ「十分」の閾値（1キャラ×1カテゴリあたり）
COVERAGE_SUFFICIENT_THRESHOLD = 5


class KnowledgeEvaluator:
    """重複排除、カバレッジ分析、ギャップクエリ生成"""

    def __init__(self, store: DataStore):
        self.store = store

    # --- 重複排除 ---

    def deduplicate(self, entries: list[KnowledgeEntry]) -> list[KnowledgeEntry]:
        """IDベースの重複排除"""
        seen_ids = set()
        unique = []
        for entry in entries:
            if not entry.id:
                entry.generate_id()
            if entry.id not in seen_ids:
                seen_ids.add(entry.id)
                unique.append(entry)

        removed = len(entries) - len(unique)
        if removed > 0:
            logger.info(f"重複排除: {len(entries)}件 → {len(unique)}件 ({removed}件除外)")
        return unique

    # --- カバレッジ分析 ---

    def analyze_coverage(self) -> CoverageMatrix:
        """全キャラ×カテゴリのカバレッジマトリクスを構築"""
        matrix: dict[str, dict[str, int]] = {}
        total_entries = 0
        all_video_ids = set()

        for slug in CHARACTER_JP_NAMES:
            knowledge = self.store.load_character_knowledge(slug)
            if not knowledge.entries:
                continue

            char_counts: dict[str, int] = defaultdict(int)
            for entry in knowledge.entries:
                char_counts[entry.category] += 1
                total_entries += 1
                all_video_ids.add(entry.source_video_id)

            matrix[slug] = dict(char_counts)

        # ギャップクエリ生成
        gap_queries = self._generate_gap_queries(matrix)

        coverage = CoverageMatrix(
            matrix=matrix,
            total_entries=total_entries,
            total_videos=len(all_video_ids),
            gap_queries=gap_queries,
        )
        self.store.save_coverage(coverage)

        logger.info(
            f"カバレッジ分析: {total_entries}件 / {len(all_video_ids)}動画 / "
            f"ギャップクエリ{len(gap_queries)}個"
        )
        return coverage

    def _generate_gap_queries(self, matrix: dict[str, dict[str, int]]) -> list[str]:
        """カバレッジの薄い領域から検索クエリを自動生成（下位キャラ優先）"""
        # キャラ別の総件数を計算して、少ない順にソート
        char_totals = {
            slug: sum(matrix.get(slug, {}).values())
            for slug in CHARACTER_JP_NAMES
        }
        sorted_chars = sorted(char_totals.items(), key=lambda x: x[1])

        gap_entries = []  # (priority_score, query)

        for slug, total in sorted_chars:
            char_jp = CHARACTER_JP_NAMES[slug]
            char_counts = matrix.get(slug, {})

            for category, topic_jp in CATEGORY_JP_NAMES.items():
                count = char_counts.get(category, 0)
                if count < COVERAGE_SUFFICIENT_THRESHOLD:
                    # 優先度: 件数が少ないキャラ×カテゴリほど高い
                    priority = (COVERAGE_SUFFICIENT_THRESHOLD - count) + max(0, 200 - total)
                    for template in GAP_QUERY_TEMPLATES:
                        query = template.format(
                            char_jp=char_jp, topic_jp=topic_jp
                        )
                        gap_entries.append((priority, query))

        # 優先度順でソートし、重複除去
        gap_entries.sort(key=lambda x: -x[0])
        seen = set()
        gap_queries = []
        for _, query in gap_entries:
            if query not in seen:
                seen.add(query)
                gap_queries.append(query)

        return gap_queries

    # --- レポート表示 ---

    def print_coverage_report(self) -> None:
        """カバレッジレポートをターミナルに表示"""
        coverage = self.store.load_coverage()

        print("\n" + "=" * 70)
        print("📊 ナレッジ カバレッジレポート")
        print("=" * 70)
        print(f"  総ナレッジ数: {coverage.total_entries}件")
        print(f"  処理済み動画: {coverage.total_videos}本")
        print()

        # カテゴリヘッダー
        categories = list(CATEGORY_JP_NAMES.keys())
        header = f"{'キャラ':<12}" + "".join(
            f"{CATEGORY_JP_NAMES[c]:>8}" for c in categories
        ) + f"{'合計':>8}"
        print(header)
        print("-" * len(header))

        for slug, char_jp in CHARACTER_JP_NAMES.items():
            char_counts = coverage.matrix.get(slug, {})
            if not char_counts:
                continue

            row = f"{char_jp:<12}"
            total = 0
            for cat in categories:
                count = char_counts.get(cat, 0)
                total += count
                # 少ない箇所をマーク
                mark = "⚠" if count < COVERAGE_SUFFICIENT_THRESHOLD else " "
                row += f"{count:>7}{mark}"
            row += f"{total:>8}"
            print(row)

        print()
        if coverage.gap_queries:
            print(f"🔍 ギャップクエリ（上位10件）:")
            for q in coverage.gap_queries[:10]:
                print(f"  - {q}")
            if len(coverage.gap_queries) > 10:
                print(f"  ... 他 {len(coverage.gap_queries) - 10}件")
        print()
