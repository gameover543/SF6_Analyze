import asyncio
import random
import logging
from playwright.async_api import Page, BrowserContext
from extractor import FrameDataExtractor
from constants import CHARACTER_LIST

logger = logging.getLogger(__name__)

class Crawler:
    """キャラクター一覧と個別のフレームデータページをクロール"""
    
    def __init__(self, config):
        self.config = config
        self.extractor = FrameDataExtractor()

    async def get_character_list(self, page: Page) -> list[dict]:
        """キャラクター名とスラッグのリストを公式サイトから取得"""
        logger.info(f"キャラクター一覧を取得中: {self.config.character_list_url}")
        
        # タイムアウトを延長し、ネットワークが落ち着くまで待機
        await page.goto(self.config.character_list_url, timeout=60000)
        await page.wait_for_load_state("networkidle", timeout=60000)
        
        # ログインが必要なページへリダイレクトされていないかチェック
        if "login" in page.url:
            logger.warning("キャラクター一覧取得時にログインページへリダイレクトされました。")
            # ログインボタン等があれば再認証が必要な可能性がある
        
        # セレクタ待機
        try:
            await page.wait_for_selector('a[href*="/character/"]', timeout=10000)
        except:
            logger.warning("キャラクターリンクのセレクタが見つかりませんでした。HTMLを直接解析します。")
        
        # キャラクター要素をセレクタで取得
        # 実際にはサイトを解析して調整が必要
        characters = []
        links = await page.query_selector_all("a[href*='/character/']")
        characters = []
        
        # ハードコードされたリストを辞書化して名前の引き当てに使用
        name_map = {c["slug"]: c["name"] for c in CHARACTER_LIST}
        
        for link in links:
            href = await link.get_attribute("href")
            # /character/ryu/ または /character/ryu/frame のような形式からスラッグを抽出
            parts = [p for p in href.split("/") if p]
            if "character" in parts:
                idx = parts.index("character")
                if len(parts) > idx + 1:
                    slug = parts[idx + 1]
                    # 除外判定
                    if slug in ["ja-jp", "en-us", "frame"]: continue
                    
                    if slug not in [c["slug"] for c in characters]:
                        # 名前の取得（テキストがあれば使用、なければマップから、なければスラッグ）
                        visible_text = await link.inner_text()
                        name = visible_text.strip() or name_map.get(slug, slug.capitalize())
                        
                        characters.append({"name": name, "slug": slug})
        
        if not characters:
            logger.warning("キャラクターリンクのセレクタが見つかりませんでした。ハードコードされたリストを使用します。")
            characters = CHARACTER_LIST
        
        logger.info(f"{len(characters)} キャラクターを発見")
        return characters

    async def scrape_character(self, page: Page, char_info: dict) -> str:
        """指定されたキャラクターのフレームデータページのHTMLを取得"""
        slug = char_info["slug"]
        url = f"{self.config.base_url}/{slug}/frame"
        
        logger.info(f"[{char_info['name']}] のデータを取得中: {url}")
        
        # ネットワーク負荷軽減と人間らしさの演出
        await self._wait_random()
        
        await page.goto(url, wait_until="networkidle")
        
        # 動的部分の読み込み待機 (必要に応じて)
        await page.wait_for_timeout(2000)
        
        return await page.content()

    async def _wait_random(self):
        delay = random.uniform(self.config.min_delay_sec, self.config.max_delay_sec)
        await asyncio.sleep(delay)
