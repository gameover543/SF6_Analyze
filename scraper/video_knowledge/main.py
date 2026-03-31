"""動画ナレッジパイプライン CLI エントリポイント

5段階自律ループ: DISCOVER → CREDIBILITY → INVESTIGATE → EXECUTE → EVALUATE

使い方:
  # 自律ループ実行
  python -m video_knowledge.main

  # 特定URLのみ処理
  python -m video_knowledge.main --urls "https://youtube.com/watch?v=xxx"

  # DISCOVERのみ（候補リスト作成）
  python -m video_knowledge.main --discover-only

  # ドライラン（Gemini呼び出しなし）
  python -m video_knowledge.main --dry-run

  # カバレッジレポート
  python -m video_knowledge.main --coverage

  # 特定キャラに絞って処理
  python -m video_knowledge.main --characters jamie ken
"""

import argparse
import logging
import signal
import sys
import time
from datetime import datetime

from .config import PipelineConfig
from .schemas import VideoProcessingRecord
from .sources import DataStore
from .discoverer import VideoDiscoverer
from .credibility import CredibilityScorer
from .investigator import VideoInvestigator
from .extractor import KnowledgeExtractor
from .validator import FrameDataValidator
from .evaluator import KnowledgeEvaluator
from .budget import BudgetTracker

logger = logging.getLogger(__name__)

# Ctrl+C で安全に停止するためのフラグ
_shutdown_requested = False


def _handle_signal(signum, frame):
    global _shutdown_requested
    _shutdown_requested = True
    print("\n⚠️  停止要求を受信。現在の動画処理完了後に安全に停止します...")


class Pipeline:
    """5段階ナレッジ抽出パイプライン"""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.store = DataStore(config)
        self.budget = BudgetTracker(
            daily_request_limit=config.daily_request_limit,
            daily_video_minutes=config.daily_video_minutes,
            min_interval_sec=config.request_interval_sec,
        )
        self.discoverer = VideoDiscoverer(config)
        self.scorer = CredibilityScorer(self.store.load_channels())
        self.investigator = VideoInvestigator(config, self.budget)
        self.extractor = KnowledgeExtractor(config, self.budget)
        self.validator = FrameDataValidator(config)
        self.evaluator = KnowledgeEvaluator(self.store)

    def run(
        self,
        urls: list[str] | None = None,
        characters: list[str] | None = None,
        discover_only: bool = False,
        dry_run: bool = False,
    ) -> None:
        """パイプラインのメインループ"""
        index = self.store.load_index()
        processed_ids = {
            v.video_id for v in index.videos
            if v.status in ("completed", "skipped")
        }

        # --- Stage 0: DISCOVER ---
        print("\n🔍 Stage 0: DISCOVER（動画発見）")
        if urls:
            # 指定URLモード
            candidates = self.discoverer.discover_from_urls(urls)
            print(f"  指定URL: {len(candidates)}件")
        else:
            # 自律発見モード
            # チャンネル巡回
            channel_candidates = self.discoverer.discover_from_channels()
            # キーワード検索
            search_candidates = self.discoverer.discover_from_search(
                target_characters=characters
            )
            # ギャップクエリ
            coverage = self.store.load_coverage()
            gap_candidates = []
            if coverage.gap_queries:
                print(f"  ギャップクエリ: {len(coverage.gap_queries)}個")
                gap_candidates = self.discoverer.discover_from_search(
                    queries=coverage.gap_queries[:20]  # 上位20件のみ
                )

            # 統合 & 重複除去
            all_candidates = channel_candidates + search_candidates + gap_candidates
            seen = set()
            candidates = []
            for c in all_candidates:
                if c.video_id not in seen:
                    seen.add(c.video_id)
                    candidates.append(c)

            print(
                f"  チャンネル: {len(channel_candidates)}件, "
                f"検索: {len(search_candidates)}件, "
                f"ギャップ: {len(gap_candidates)}件 "
                f"→ 統合: {len(candidates)}件"
            )

        # メタデータフィルタ
        candidates = self.discoverer.filter_candidates(candidates, processed_ids)
        print(f"  フィルタ後: {len(candidates)}件")

        if not candidates:
            print("  処理対象の動画がありません。")
            self._finalize(index)
            return

        if discover_only:
            # 候補リストを保存して終了
            queue = self.store.load_queue()
            for c in candidates:
                queue.add_candidate(c)
            self.store.save_queue(queue)
            print(f"  候補キューに{len(candidates)}件を保存しました。")
            return

        # --- Stage 1: CREDIBILITY ---
        print("\n🏷️  Stage 1: CREDIBILITY（信頼性評価）")
        candidates = self.scorer.score_all(candidates)
        print(f"  通過: {len(candidates)}件")

        if dry_run:
            self._print_dry_run_results(candidates)
            return

        # --- Stage 2-3: INVESTIGATE + EXECUTE ---
        print("\n🎬 Stage 2-3: INVESTIGATE → EXECUTE（精査 → 抽出）")
        total_entries = 0
        processed_count = 0

        for i, candidate in enumerate(candidates):
            if _shutdown_requested:
                print("⚠️  安全に停止します。")
                break

            if not self.budget.can_process(candidate.duration_seconds):
                print(f"  ⚠️  予算上限到達。{self.budget.summary()}")
                break

            print(
                f"\n  [{i+1}/{len(candidates)}] {candidate.title[:50]}"
                f" ({candidate.duration_seconds//60}分"
                f", 信頼={candidate.credibility_score:.2f})"
            )

            record = VideoProcessingRecord(
                video_id=candidate.video_id,
                url=candidate.url,
                title=candidate.title,
                channel_name=candidate.channel_name,
                credibility_score=candidate.credibility_score,
                status="processing",
            )
            start_time = time.time()

            # INVESTIGATE（信頼度が高ければスキップ）
            is_coaching = False
            if self.scorer.needs_investigation(candidate):
                result = self.investigator.investigate(candidate)
                if not result.passed:
                    record.status = "skipped"
                    record.skip_reason = result.error or "INVESTIGATE不通過"
                    record.relevance_score = result.knowledge_density
                    record.processed_at = datetime.now().isoformat()
                    index.add_record(record)
                    self.store.save_index(index)
                    print(f"    → スキップ: {record.skip_reason}")
                    continue
                record.relevance_score = result.knowledge_density
                is_coaching = result.is_coaching
            else:
                print(f"    → Sランクチャンネル: INVESTIGATEスキップ")
                record.relevance_score = 1.0
                # タイトルからコーチング判定（Sランクはスキップされるため）
                title_lower = candidate.title.lower()
                if any(kw in title_lower for kw in ["コーチング", "coaching", "コーチ"]):
                    is_coaching = True

            if is_coaching:
                print(f"    → コーチング動画として処理")

            # EXECUTE
            entries = self.extractor.extract(candidate, is_coaching=is_coaching)
            if not entries:
                record.status = "completed"
                record.entries_extracted = 0
                record.processing_time_seconds = time.time() - start_time
                record.processed_at = datetime.now().isoformat()
                index.add_record(record)
                self.store.save_index(index)
                print(f"    → 知識なし")
                continue

            # バリデーション
            entries = self.validator.validate_entries(entries)
            entries = self.evaluator.deduplicate(entries)

            # 保存
            added = self.store.add_entries(entries)
            total_entries += added
            processed_count += 1

            record.status = "completed"
            record.entries_extracted = added
            record.processing_time_seconds = time.time() - start_time
            record.processed_at = datetime.now().isoformat()
            index.add_record(record)
            self.store.save_index(index)

            # チャンネル統計更新
            density = len(entries) / max(candidate.duration_seconds / 60, 1)
            self.scorer.update_channel_stats(
                candidate.channel_name, added, density
            )

            print(f"    → ✅ {added}件の知識を保存")

        # --- Stage 4: EVALUATE ---
        self._finalize(index)

        print(f"\n{'='*50}")
        print(f"📊 実行結果:")
        print(f"  処理動画: {processed_count}本")
        print(f"  抽出知識: {total_entries}件")
        print(f"  {self.budget.summary()}")

    def _finalize(self, index) -> None:
        """パイプライン終了処理"""
        print("\n📈 Stage 4: EVALUATE（カバレッジ分析）")
        coverage = self.evaluator.analyze_coverage()
        self.store.save_index(index)
        self.store.save_channels(self.scorer.channels)
        print(
            f"  総ナレッジ: {coverage.total_entries}件 / "
            f"{coverage.total_videos}動画"
        )
        if coverage.gap_queries:
            print(f"  次回用ギャップクエリ: {len(coverage.gap_queries)}個")

        # 構造化インデックスを再構築
        print("\n📂 構造化インデックス再構築...")
        try:
            from .structurizer import build_structured_index
            result = build_structured_index(self.config)
            print(
                f"  マッチアップ: {result['matchup_indexes']}件, "
                f"カテゴリ: {result['category_indexes']}件, "
                f"状況: {result['situation_indexes']}件"
            )
        except Exception as e:
            print(f"  ⚠ インデックス構築スキップ: {e}")

    def _print_dry_run_results(self, candidates) -> None:
        """ドライランの結果表示"""
        print("\n📋 ドライラン結果（Gemini呼び出しなし）:")
        for i, c in enumerate(candidates[:30]):
            needs_inv = "要精査" if self.scorer.needs_investigation(c) else "直接抽出"
            print(
                f"  {i+1}. [{c.credibility_score:.2f}] [{needs_inv}] "
                f"{c.channel_name}: {c.title[:45]} "
                f"({c.duration_seconds//60}分, {c.view_count:,}回)"
            )
        if len(candidates) > 30:
            print(f"  ... 他 {len(candidates) - 30}件")


def main():
    parser = argparse.ArgumentParser(
        description="SF6プロ解説動画 → ナレッジDB パイプライン"
    )
    parser.add_argument(
        "--urls", nargs="+",
        help="処理する動画URLのリスト（DISCOVERスキップ）"
    )
    parser.add_argument(
        "--characters", nargs="+",
        help="対象キャラクターのslug（例: jamie ken）"
    )
    parser.add_argument(
        "--discover-only", action="store_true",
        help="DISCOVERのみ実行（候補リスト作成）"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="ドライラン（Gemini呼び出しなし）"
    )
    parser.add_argument(
        "--coverage", action="store_true",
        help="カバレッジレポートを表示"
    )
    parser.add_argument(
        "--budget-minutes", type=int, default=480,
        help="日次動画時間予算（分、デフォルト480=8時間）"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="詳細ログ出力"
    )

    args = parser.parse_args()

    # ログ設定
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    config = PipelineConfig()
    config.daily_video_minutes = args.budget_minutes

    # API キーチェック
    if not config.google_api_key and not args.dry_run and not args.discover_only and not args.coverage:
        print("❌ GOOGLE_API_KEY が設定されていません。.env を確認してください。")
        sys.exit(1)

    pipeline = Pipeline(config)

    # カバレッジレポートモード
    if args.coverage:
        pipeline.evaluator.print_coverage_report()
        return

    # Ctrl+C ハンドラ登録
    signal.signal(signal.SIGINT, _handle_signal)

    # パイプライン実行
    pipeline.run(
        urls=args.urls,
        characters=args.characters,
        discover_only=args.discover_only,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
