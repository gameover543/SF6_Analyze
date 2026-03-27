import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from playwright.async_api import async_playwright, BrowserContext, Page
import logging

logger = logging.getLogger(__name__)

class AuthManager:
    """CAPCOM IDログイン・セッション管理"""
    
    def __init__(self, config):
        self.config = config
        self._context: BrowserContext | None = None
    
    async def get_authenticated_context(self, playwright) -> BrowserContext:
        """認証済みブラウザコンテキストを取得"""
        browser = await playwright.chromium.launch(
            headless=False, # ログインが必要な可能性があるため初回はブラウザを表示
            args=["--disable-blink-features=AutomationControlled"]
        )
        
        if self._is_session_valid():
            logger.info("保存されたセッションを読み込んでいます...")
            context = await browser.new_context(
                storage_state=str(self.config.storage_state_path),
                user_agent=self._get_user_agent(),
                viewport={"width": 1280, "height": 800},
            )
            # セッションが本当に有効かチェック
            if await self._verify_session_on_site(context):
                logger.info("セッションは有効です")
                self._context = context
                return context
            else:
                logger.warning("保存されたセッションが無効です。再ログインが必要です。")
                await context.close()
        
        # 新規ログイン
        logger.info("新規ログインを開始します...")
        context = await browser.new_context(
            user_agent=self._get_user_agent(),
            viewport={"width": 1280, "height": 800},
        )
        await self._perform_manual_login(context)
        self._context = context
        return context
    
    async def _perform_manual_login(self, context: BrowserContext):
        """手動ログインを待機し、セッションを保存する"""
        page = await context.new_page()
        await page.goto(self.config.base_url)
        
        print("\n" + "!" * 60)
        print("🔐 CAPCOM IDでログインしてください。")
        print("ブラウザでログイン操作を完了し、フレームデータが表示されたら")
        print("ターミナルに戻り、Enterキーを押してください。")
        print("!" * 60 + "\n")
        
        # ユーザーの入力を待機（同期的なinputは非同期処理を止めるため、スレッドで実行するか工夫が必要だが
        # ここでは単純化のため同期的に待機）
        await asyncio.to_thread(input, "ログイン完了後、Enterキーを押してください...")
        
        # セッション保存
        await self.save_session(context)
        logger.info(f"セッションを保存しました: {self.config.storage_state_path}")
        await page.close()

    async def save_session(self, context: BrowserContext):
        """現在のコンテキストの状態を保存"""
        state = await context.storage_state()
        with open(self.config.storage_state_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
            
    async def _verify_session_on_site(self, context: BrowserContext) -> bool:
        """実際にサイトにアクセスしてログイン状態を確認"""
        page = await context.new_page()
        try:
            # ログインが必要なはずのページへ飛ぶ
            await page.goto(f"{self.config.base_url}/framedata/ryu", timeout=20000)
            await page.wait_for_load_state("networkidle")
            
            # ログインボタンがある場合は未ログインとみなす
            # CAPCOM Bucklerサイトの構造に依存
            login_elements = await page.query_selector_all('a[href*="login"], .btn-login')
            return len(login_elements) == 0
        except Exception as e:
            logger.error(f"セッション検証中にエラー: {e}")
            return False
        finally:
            await page.close()

    def _is_session_valid(self) -> bool:
        """ファイルが存在し、期限内かチェック"""
        if not self.config.storage_state_path.exists():
            return False
        
        file_time = datetime.fromtimestamp(self.config.storage_state_path.stat().st_mtime)
        return datetime.now() - file_time < timedelta(hours=self.config.session_max_age_hours)

    def _get_user_agent(self) -> str:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
