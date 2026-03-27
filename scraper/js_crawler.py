"""
JSチャンク方式のクローラー。

SF6公式サイトのフレームデータページにアクセスし、
全キャラ分のデータが入ったJSチャンクを1回で取得する。
"""
import asyncio
import re
import logging
from playwright.async_api import BrowserContext, Response

logger = logging.getLogger(__name__)


class JSCrawler:
    """JSチャンクからフレームデータを取得するクローラー"""

    # フレームページのJSチャンクURLパターン
    FRAME_JS_PATTERN = re.compile(r"frame-[a-f0-9]+\.js$")

    def __init__(self, config):
        self.config = config

    async def fetch_frame_js(self, context: BrowserContext) -> str:
        """
        フレームデータページにアクセスし、全キャラ分のデータが入った
        JSチャンクを取得する。どのキャラのページでもよい（同じJSが読まれる）。

        Args:
            context: 認証済みブラウザコンテキスト

        Returns:
            JSチャンクの文字列（全キャラ分のフレームデータを含む）
        """
        # どのキャラのフレームページでもOK（全キャラ共通のJSチャンクが読まれる）
        url = f"{self.config.base_url}/ryu/frame"
        logger.info(f"フレームデータページにアクセス中: {url}")

        page = await context.new_page()
        frame_js_content = None
        capture_event = asyncio.Event()

        async def on_response(response: Response):
            nonlocal frame_js_content
            resp_url = response.url
            if self.FRAME_JS_PATTERN.search(resp_url):
                try:
                    body = await response.text()
                    if '"frame":[' in body and "startup_frame" in body:
                        frame_js_content = body
                        logger.info(f"JSチャンクを捕捉 ({len(body):,} bytes)")
                        capture_event.set()
                except Exception as e:
                    logger.warning(f"JSチャンク読み取りエラー: {e}")

        page.on("response", lambda r: asyncio.ensure_future(on_response(r)))

        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)

            # JSチャンクの捕捉を最大15秒待機
            try:
                await asyncio.wait_for(capture_event.wait(), timeout=15)
            except asyncio.TimeoutError:
                logger.warning("JSチャンクの捕捉がタイムアウト。ページ内のscriptタグから探します。")

            # 捕捉できなかった場合のフォールバック
            if frame_js_content is None:
                frame_js_content = await self._find_frame_js_in_page(page)

            if frame_js_content is None:
                raise ValueError("フレームデータJSチャンクが見つかりません")

            return frame_js_content

        finally:
            await page.close()

    async def _find_frame_js_in_page(self, page) -> str | None:
        """ページ内のscriptタグからframe-xxx.jsを取得する"""
        script_urls = await page.evaluate("""
            () => {
                const scripts = document.querySelectorAll('script[src]');
                return Array.from(scripts).map(s => s.src).filter(s => s.includes('frame'));
            }
        """)

        for script_url in script_urls:
            logger.info(f"scriptタグからJSチャンクを取得: {script_url}")
            try:
                response = await page.context.request.get(script_url)
                body = await response.text()
                if '"frame":[' in body and "startup_frame" in body:
                    return body
            except Exception as e:
                logger.warning(f"取得失敗: {e}")

        return None
