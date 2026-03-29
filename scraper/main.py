"""
SF6フレームデータスクレイパー（v2: JSチャンク方式）

公式サイトのJSチャンクから全キャラのフレームデータを一括抽出する。
1回のページアクセスで全キャラ分のClassic/Modernデータを取得できる。
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# scraper/ディレクトリ外から実行された場合でもインポートできるようにする
sys.path.insert(0, str(Path(__file__).parent))

from playwright.async_api import async_playwright

from config import ScraperConfig
from auth import AuthManager
from js_crawler import JSCrawler
from js_extractor import JSFrameDataExtractor
from patch_diff import snapshot_frame_data, compute_diff, save_diff

# ログディレクトリの作成
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(parents=True, exist_ok=True)

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_dir / "scraper.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


async def run_scraper(force: bool = False, targets: list[str] | None = None):
    """
    フレームデータをスクレイピングして更新する。
    1回のアクセスで全キャラ分を一括取得する。

    Args:
        force: Trueの場合、キャッシュを無視して全キャラ再取得
        targets: 指定した場合、そのスラッグのキャラのみ保存（例: ["jamie", "ryu"]）
    """
    config = ScraperConfig()
    auth = AuthManager(config)
    crawler = JSCrawler(config)
    extractor = JSFrameDataExtractor()

    # パッチdiff用: スクレイピング前に旧データをスナップショット
    old_snapshot = snapshot_frame_data(config.output_dir) if force else {}

    async with async_playwright() as p:
        # ブラウザコンテキストの取得（認証済み）
        context = await auth.get_authenticated_context(p)

        try:
            # 1. JSチャンクを1回で取得（全キャラ分のデータが入っている）
            logger.info("JSチャンクを取得中...")
            js_content = await crawler.fetch_frame_js(context)

            # 2. 全キャラ分のフレームデータを一括抽出
            logger.info("フレームデータを抽出中...")
            all_data = extractor.extract_all_from_js(js_content)

            # 3. 保存
            success_count = 0
            for slug, frame_data in all_data.items():
                # ターゲット指定がある場合、対象外はスキップ
                if targets and slug not in targets:
                    continue

                # キャッシュチェック（forceモードでない場合のみ）
                cache_file = config.output_dir / f"{slug}.json"
                if not force and cache_file.exists():
                    logger.info(f"キャッシュあり: {frame_data.character_name} (スキップ)")
                    continue

                data_to_save = frame_data.model_dump()
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)

                success_count += 1

            # 4. 全キャラ統合データの保存
            all_results = {}
            for json_file in config.output_dir.glob("*.json"):
                with open(json_file, "r", encoding="utf-8") as f:
                    all_results[json_file.stem] = json.load(f)

            output_file = config.data_dir / "all_characters_frame.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2)

            logger.info(
                f"\n完了: {success_count}キャラ更新, "
                f"全{len(all_data)}キャラ抽出成功\n"
                f"保存先: {config.output_dir}"
            )

            # パッチdiff: 旧データと新データを比較
            if force and old_snapshot:
                new_snapshot = snapshot_frame_data(config.output_dir)
                diff = compute_diff(old_snapshot, new_snapshot)
                if diff:
                    patches_dir = config.data_dir / "patches"
                    save_diff(diff, patches_dir)
                    logger.info(f"パッチdiff保存完了。ナレッジ再バリデーションを実行...")
                    # 再バリデーション自動実行
                    try:
                        from video_knowledge.revalidator import revalidate_knowledge
                        revalidate_knowledge(diff, config.data_dir)
                    except ImportError:
                        logger.warning("revalidator未実装。スキップ。")
                    except Exception as e:
                        logger.error(f"再バリデーション失敗: {e}")

        finally:
            await context.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SF6フレームデータスクレイパー (v2: JSチャンク方式)")
    parser.add_argument("--force", action="store_true", help="キャッシュを無視して全キャラ再取得")
    parser.add_argument("--targets", nargs="*", help="取得対象のキャラスラッグ（例: jamie ryu）")
    args = parser.parse_args()

    try:
        asyncio.run(run_scraper(force=args.force, targets=args.targets))
    except KeyboardInterrupt:
        logger.info("ユーザーにより停止されました")
    except Exception as e:
        logger.critical(f"予期せぬエラー: {e}", exc_info=True)
