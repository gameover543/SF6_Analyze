import asyncio
import json
import logging
from pathlib import Path
from playwright.async_api import async_playwright

from config import ScraperConfig
from auth import AuthManager
from crawler import Crawler
from extractor import FrameDataExtractor
from llm_agent import LLMAgent

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/scraper.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

async def run_scraper():
    config = ScraperConfig()
    auth = AuthManager(config)
    crawler = Crawler(config)
    extractor = FrameDataExtractor()
    llm = LLMAgent(config)

    async with async_playwright() as p:
        # ブラウザコンテキストの取得（認証済み）
        context = await auth.get_authenticated_context(p)
        page = await context.new_page()

        try:
            # 1. キャラクター一覧を取得
            characters = await crawler.get_character_list(page)
            if not characters:
                logger.error("キャラクター一覧の取得に失敗しました。")
                return

            all_results = {}

            # 2. キャラクターごとに巡回
            for char in characters:
                name = char["name"]
                slug = char["slug"]
                
                # キャッシュチェック（簡易版）
                cache_file = config.output_dir / f"{slug}.json"
                if cache_file.exists():
                    logger.info(f"キャッシュが見つかりました: {name} (スキップ)")
                    with open(cache_file, "r", encoding="utf-8") as f:
                        all_results[slug] = json.load(f)
                    continue

                html = await crawler.scrape_character(page, char)
                
                try:
                    # 抽出
                    data = extractor.extract(html, name, slug)
                    
                    # LLMによるクリーンアップ（オプション）
                    if config.llm_fallback_enabled:
                        logger.info(f"LLMでデータを正規化中: {name}")
                        cleaned_data = await llm.clean_data(name, data.model_dump_json())
                        data_to_save = cleaned_data
                    else:
                        data_to_save = data.model_dump()

                    # 保存
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(data_to_save, f, ensure_ascii=False, indent=2)
                    
                    all_results[slug] = data_to_save
                    logger.info(f"成功: {name} ({len(data_to_save.get('moves', []))}技)")

                except Exception as e:
                    logger.error(f"エラー: {name} の抽出に失敗 - {e}")
                    # 必要に応じてLLMフォールバック
                    if config.llm_fallback_enabled:
                        logger.info(f"LLMフォールバック実行中: {name}")
                        fallback_data = await llm.fallback_extract(html, name)
                        if fallback_data.get("moves"):
                            with open(cache_file, "w", encoding="utf-8") as f:
                                json.dump(fallback_data, f, ensure_ascii=False, indent=2)
                            all_results[slug] = fallback_data

            # 3. 最終結果の集約
            output_file = config.data_dir / "all_characters_frame.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2)
            
            logger.info(f"全件データ保存完了: {output_file}")

        finally:
            await context.close()

if __name__ == "__main__":
    try:
        asyncio.run(run_scraper())
    except KeyboardInterrupt:
        logger.info("ユーザーにより停止されました")
    except Exception as e:
        logger.critical(f"予期せぬエラー: {e}")
