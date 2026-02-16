import re
import hashlib
import json
from datetime import datetime
from bs4 import BeautifulSoup, Tag
from pydantic import BaseModel, Field, field_validator
import logging

logger = logging.getLogger(__name__)

class MoveData(BaseModel):
    """技詳細データ"""
    move_name: str = Field(..., description="技名")
    move_type: str = ""
    startup: str = ""
    active: str = ""
    recovery: str = ""
    on_hit: str = ""
    on_block: str = ""
    damage: str = ""
    guard: str = ""
    cancel: str = ""
    scaling: str = ""
    notes: str = ""

    @field_validator("startup", "active", "recovery", "on_hit", "on_block")
    @classmethod
    def normalize_frames(cls, v: str) -> str:
        if not v: return ""
        # 全角→半角、不要な記号の処理
        v = v.translate(str.maketrans('０１２３４５６７８９＋－', '0123456789+-'))
        return v.strip()

class CharacterFrameData(BaseModel):
    """キャラクター全技データ"""
    character_name: str
    slug: str
    moves: list[MoveData]
    extracted_at: str = Field(default_factory=lambda: datetime.now().isoformat())

class FrameDataExtractor:
    """HTMLからフレームデータを抽出するクラス"""
    
    # 列名のパターン（サイト更新に耐えられるよう複数定義）
    COL_PATTERNS = {
        "move_name": [r"^技名$"],
        "startup": [r"^発生$", r"発生持続"],
        "active": [r"^持続$"],
        "recovery": [r"^硬直$"],
        "on_hit": [r"硬直差.*ヒット", r"^ヒット時$"],
        "on_block": [r"硬直差.*ガード", r"^ガード時$"],
        "damage": [r"^ダメージ$"],
        "guard": [r"ガード種別"],
        "cancel": [r"^キャンセル$"],
    }

    def extract(self, html: str, character_name: str, slug: str) -> CharacterFrameData:
        soup = BeautifulSoup(html, "html.parser")
        table = self._find_target_table(soup)
        
        if not table:
            raise ValueError(f"フレームデータテーブルが見つかりません: {character_name}")
        
        col_map = self._get_column_mapping(table)
        moves = []
        
        # tbody または tr (ヘッダー以外) を走査
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            # ヘッダー行はスキップ（マッピングで使用済み）
            if any(cell.name == "th" for cell in cells) and len(moves) == 0:
                continue
            
            if len(cells) < 3: continue # 技名すらなさそうな行はスキップ
            
            move = self._parse_row(cells, col_map)
            if move and move.move_name:
                moves.append(move)
        
        return CharacterFrameData(
            character_name=character_name,
            slug=slug,
            moves=moves
        )

    def _find_target_table(self, soup: BeautifulSoup) -> Tag | None:
        """フレームデータが含まれるテーブルを特定"""
        # クラス名やIDで探す
        table = soup.select_one("table.frame-data, .frame-data-table table")
        if table: return table
        
        # なければ、「技名」「発生」などのキーワードを含むテーブルを探す
        for table in soup.find_all("table"):
            header_text = table.get_text()
            if "技名" in header_text or "発生" in header_text:
                return table
        return None

    def _get_column_mapping(self, table: Tag) -> dict[str, int]:
        """ヘッダーからどの列がどのデータか特定"""
        # 将来的にサイトが変わった場合のために、自動検知を試みる
        detected = {}
        rows = table.find_all("tr")[:3]
        all_header_text = ""
        for row in rows:
            cells = row.find_all(["th", "td"])
            for i, h in enumerate(cells):
                text = h.get_text(strip=True).lower()
                all_header_text += text
                for key, patterns in self.COL_PATTERNS.items():
                    if key in detected: continue
                    if any(re.search(p, text) for p in patterns):
                        detected[key] = i
                        break
        
        # SF6公式サイト（Buckler's Boot Camp）の構造を検知
        if "動作フレーム" in all_header_text or "dゲージ" in all_header_text:
            logger.info("SF6公式サイトの構造を検知しました。固定マッピングを使用します。")
            return {
                "move_name": 0,
                "startup": 1,
                "active": 2,
                "recovery": 3,
                "on_hit": 4,
                "on_block": 5,
                "cancel": 6,
                "damage": 7,
                "scaling": 8,
                "guard": 13,
                "notes": 14
            }
            
        return detected

    def _parse_row(self, cells: list[Tag], col_map: dict) -> MoveData | None:
        try:
            data = {}
            for field, idx in col_map.items():
                if idx < len(cells):
                    data[field] = cells[idx].get_text().strip()
            
            # 必須フィールドの確認
            if not data.get("move_name"): return None
            
            return MoveData(**data)
        except Exception as e:
            logger.debug(f"行のパースに失敗: {e}")
            return None
