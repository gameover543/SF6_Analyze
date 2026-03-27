from dataclasses import dataclass, field
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

@dataclass
class ScraperConfig:
    """SF6フレームデータスクレイパーの設定"""
    # URL設定
    base_url: str = "https://www.streetfighter.com/6/ja-jp/character"
    character_list_url: str = "https://www.streetfighter.com/6/ja-jp/character"
    
    # パス設定（プロジェクトルート基準）
    root_dir: Path = Path(__file__).parent.parent
    data_dir: Path = root_dir / "data"
    session_dir: Path = data_dir / "session"
    output_dir: Path = data_dir / "frame_data"
    storage_state_path: Path = session_dir / "storage_state.json"
    cookie_backup_path: Path = session_dir / "cookies_backup.json"
    db_path: Path = data_dir / "metadata.db"
    log_dir: Path = Path(__file__).parent / "logs"
    
    # スクレイピング挙動
    min_delay_sec: float = 3.0
    max_delay_sec: float = 8.0
    max_retries: int = 3
    retry_backoff_base: float = 2.0
    
    # セッション管理
    session_max_age_hours: int = 12
    
    # LLM設定
    llm_model: str = "gemini-2.0-flash"
    llm_fallback_enabled: bool = False
    google_api_key: str = field(default_factory=lambda: os.getenv("GOOGLE_API_KEY", ""))

    def __post_init__(self):
        # 必要なディレクトリの作成
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
