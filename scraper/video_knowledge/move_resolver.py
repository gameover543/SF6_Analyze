"""技名解決エンジン: テキスト中の技名をframe dataのweb_idに紐づける

用途:
  - 抽出時: referenced_moves フィールドの自動設定
  - 再バリデーション時: 変更された技に言及するナレッジの特定
  - validator改善: 「発生5F」がどの技の話か特定
"""

import json
import re
import logging
from pathlib import Path
from functools import lru_cache

logger = logging.getLogger(__name__)

# 一般的な技の略称 → コマンド表記
COMMON_ABBREVIATIONS: dict[str, list[str]] = {
    # 通常技の略称
    "小パン": ["5LP", "2LP"],
    "小足": ["2LK"],
    "コパン": ["5LP", "2LP"],
    "コパ": ["5LP", "2LP"],
    "中パン": ["5MP", "2MP"],
    "中足": ["2MK"],
    "大パン": ["5HP", "2HP"],
    "大足": ["2HK"],
    "大K": ["5HK"],
    # しゃがみ表記
    "しゃがみ弱P": ["2LP"],
    "しゃがみ弱K": ["2LK"],
    "しゃがみ中P": ["2MP"],
    "しゃがみ中K": ["2MK"],
    "しゃがみ強P": ["2HP"],
    "しゃがみ強K": ["2HK"],
    # 立ち表記
    "立ち弱P": ["5LP"],
    "立ち弱K": ["5LK"],
    "立ち中P": ["5MP"],
    "立ち中K": ["5MK"],
    "立ち強P": ["5HP"],
    "立ち強K": ["5HK"],
    # ジャンプ表記
    "ジャンプ弱P": ["j.LP"],
    "ジャンプ弱K": ["j.LK"],
    "ジャンプ中P": ["j.MP"],
    "ジャンプ中K": ["j.MK"],
    "ジャンプ強P": ["j.HP"],
    "ジャンプ強K": ["j.HK"],
}


class MoveResolver:
    """テキスト中の技名をframe dataのweb_idに解決する"""

    def __init__(self, frame_data_dir: Path):
        self.frame_data_dir = frame_data_dir
        # {slug: {pattern: web_id}} のルックアップテーブル
        self._lookup: dict[str, dict[str, str]] = {}

    def _load_character(self, slug: str) -> dict[str, str]:
        """キャラの技名→web_idルックアップテーブルを構築（キャッシュ）"""
        if slug in self._lookup:
            return self._lookup[slug]

        path = self.frame_data_dir / f"{slug}.json"
        if not path.exists():
            self._lookup[slug] = {}
            return {}

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self._lookup[slug] = {}
            return {}

        moves = data.get("moves", data) if isinstance(data, dict) else data
        if not isinstance(moves, list):
            self._lookup[slug] = {}
            return {}

        lookup: dict[str, str] = {}
        for move in moves:
            web_id = move.get("web_id", "")
            if not web_id:
                continue

            # skill フィールドから技名を抽出: "立ち弱P（杯打）" → ["立ち弱P", "杯打"]
            skill = move.get("skill", "")
            if skill:
                # メインの技名（括弧の前）
                main_name = re.split(r'[（(]', skill)[0].strip()
                if main_name:
                    lookup[main_name] = web_id
                    # スペース除去バリエーション（"弱 酔疾歩" → "弱酔疾歩"）
                    no_space = main_name.replace(" ", "")
                    if no_space != main_name:
                        lookup[no_space] = web_id
                # 括弧内の固有名
                paren_match = re.search(r'[（(](.+?)[）)]', skill)
                if paren_match:
                    lookup[paren_match.group(1).strip()] = web_id

            # name フィールド: "(5LP)" → "5LP"
            name = move.get("name", "")
            clean_name = name.strip("() ")
            if clean_name:
                lookup[clean_name] = web_id

            # command フィールド
            cmd = move.get("command", "")
            if cmd:
                lookup[cmd] = web_id

        # 略称辞書のマッピングを追加
        for abbr, commands in COMMON_ABBREVIATIONS.items():
            for cmd in commands:
                if cmd in lookup:
                    lookup[abbr] = lookup[cmd]
                    break  # 最初にマッチしたものを使う

        self._lookup[slug] = lookup
        return lookup

    def resolve(self, text: str, character_slug: str) -> list[str]:
        """テキストから技web_idのリストを返す（重複なし）"""
        lookup = self._load_character(character_slug)
        if not lookup:
            return []

        found_ids: set[str] = set()

        # 長いキー順にマッチング（「しゃがみ中K」が「中K」より先にマッチするように）
        sorted_keys = sorted(lookup.keys(), key=len, reverse=True)

        for key in sorted_keys:
            if key in text:
                found_ids.add(lookup[key])

        return sorted(found_ids)

    def resolve_for_entry(
        self, content: str, source_quote: str, character_slugs: list[str]
    ) -> list[str]:
        """ナレッジエントリのcontent + source_quoteから参照技を解決"""
        text = f"{content} {source_quote}"
        all_ids: set[str] = set()

        for slug in character_slugs:
            ids = self.resolve(text, slug)
            all_ids.update(ids)

        return sorted(all_ids)

    def get_move_name(self, character_slug: str, web_id: str) -> str:
        """web_idから技名（skill）を取得"""
        path = self.frame_data_dir / f"{character_slug}.json"
        if not path.exists():
            return web_id

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            moves = data.get("moves", data) if isinstance(data, dict) else data
            for move in moves:
                if move.get("web_id") == web_id:
                    return move.get("skill", web_id)
        except (json.JSONDecodeError, OSError):
            pass

        return web_id

    def get_game_version(self) -> str:
        """現在のフレームデータバージョンを取得"""
        # 任意のキャラのversionフィールドを読む
        for f in self.frame_data_dir.glob("*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                if isinstance(data, dict) and "version" in data:
                    return data["version"]
            except (json.JSONDecodeError, OSError):
                continue
        return ""
