"""
JSチャンクからフレームデータを抽出するエクストラクター。

SF6公式サイト（Buckler's Boot Camp）のフレームデータページは、
Next.jsのJSチャンク内にJSON.parse('{"frame":[...]}')形式で
全キャラ分の技データが1ファイルに埋め込まれている（29キャラ=29個のJSON.parse）。
このモジュールは全キャラ分を一括抽出し、キャラ名で紐付ける。
"""
import json
import re
import logging
from datetime import datetime
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ========== データモデル ==========

class MoveFrameData(BaseModel):
    """1技分のフレームデータ（Classic/Modern両対応）"""
    # 識別情報
    web_id: str = ""
    name: str = ""            # 内部名 (例: "(5LP)")
    skill: str = ""           # 表示名 (例: "立ち弱P（クイックジャブ）")
    move_type: str = ""       # NORMAL, SPECIAL, SA, UNIQUE 等

    # コマンド（Classic / Modern）
    command: str | None = None          # クラシック操作 (例: "LP", "236P")
    command_modern: str | None = None   # モダン操作 (例: "弱", "SP + 弱")

    # フレームデータ
    startup_frame: str = ""
    active_frame: str = ""
    recovery_frame: str = ""
    total_frame: str = ""     # 全体フレーム
    block_frame: str = ""     # ガード時硬直差
    hit_frame: str = ""       # ヒット時硬直差

    # 属性・ダメージ
    attribute: str = ""       # ガード種別（上、下、中 等）
    damage: str = ""
    combo_correct: list[str] = Field(default_factory=list)  # コンボ補正

    # キャンセル
    cancel: str = ""          # 内部キャンセルデータ
    web_cancel: str = ""      # 表示用キャンセル記号

    # ゲージ関連
    drive_gauge_gain_hit: str = ""      # ドライブゲージ増加（ヒット時）
    drive_gauge_gain_parry: str = ""    # ドライブゲージ増加（パリィ時）
    drive_gauge_lose_dguard: str = ""   # ドライブゲージ減少（ドライブガード時）
    drive_gauge_lose_punish: str = ""   # ドライブゲージ減少（パニカン時）
    sa_gauge_gain: str = ""             # SAゲージ増加

    # 備考
    note: list[str] = Field(default_factory=list)
    translation: str = ""


class CharacterFrameDataV2(BaseModel):
    """キャラクター全技データ（v2: Classic/Modern両対応）"""
    character_name: str
    slug: str
    version: str = "2"       # データ形式バージョン
    moves: list[MoveFrameData]
    extracted_at: str = Field(default_factory=lambda: datetime.now().isoformat())


# （キャラクター識別はJSコード内のマッピングオブジェクトを直接パースする）

# slugからキャラ名への逆引き（constants.pyと同期）
SLUG_TO_NAME = {
    "ryu": "Ryu", "luke": "Luke", "jamie": "Jamie", "chunli": "Chun-Li",
    "guile": "Guile", "kimberly": "Kimberly", "juri": "Juri", "ken": "Ken",
    "blanka": "Blanka", "dhalsim": "Dhalsim", "ehonda": "E.Honda",
    "deejay": "Dee Jay", "manon": "Manon", "marisa": "Marisa", "jp": "JP",
    "zangief": "Zangief", "lily": "Lily", "cammy": "Cammy", "rashid": "Rashid",
    "aki": "A.K.I.", "ed": "Ed", "gouki": "Akuma", "mbison": "M.Bison",
    "terry": "Terry", "mai": "Mai", "elena": "Elena", "cviper": "C.Viper",
    "sagat": "Sagat", "alex": "Alex",
}


class JSFrameDataExtractor:
    """JSチャンクからフレームデータJSONを一括抽出する"""

    # JSチャンク内のJSON.parseパターン（変数代入付き）
    # 例: k=JSON.parse('{"frame":[...]}')
    VAR_FRAME_PATTERN = re.compile(r"""(\w+)=JSON\.parse\('(\{"frame":\[.+?\})'\)""")

    # スラッグ→変数名のマッピングオブジェクト
    # 例: {alex:k,cviper:w,sagat:A,...,ryu:q}
    SLUG_MAP_PATTERN = re.compile(r"""\{((?:\w+:\w+,)*\w+:\w+)\}""")

    def extract_all_from_js(self, js_content: str) -> dict[str, CharacterFrameDataV2]:
        """
        1つのJSチャンクから全キャラのフレームデータを一括抽出する。

        Args:
            js_content: JSチャンクの全文

        Returns:
            dict: slug → CharacterFrameDataV2 のマッピング
        """
        # 1. 変数名→JSONデータのマッピングを構築
        var_to_data = {}
        matches = list(self.VAR_FRAME_PATTERN.finditer(js_content))
        logger.info(f"JSチャンク内に {len(matches)} 個のフレームデータJSONを検出")

        for match in matches:
            var_name = match.group(1)
            raw_json = match.group(2)
            try:
                data = self._decode_json(raw_json)
                if "frame" in data:
                    var_to_data[var_name] = data["frame"]
            except Exception as e:
                logger.warning(f"変数 {var_name} のJSONデコードエラー: {e}")

        logger.info(f"デコード成功: {len(var_to_data)}/{len(matches)} 個")

        # 2. スラッグ→変数名のマッピングをJS内から探す
        slug_to_var = self._find_slug_var_mapping(js_content, set(var_to_data.keys()))
        logger.info(f"スラッグマッピング: {len(slug_to_var)} キャラ分を検出")

        # 3. スラッグ→フレームデータの組み立て
        results = {}
        for slug, var_name in slug_to_var.items():
            if var_name not in var_to_data:
                logger.warning(f"  {slug}: 変数 {var_name} のデータが見つかりません")
                continue

            raw_moves = var_to_data[var_name]
            # slugの正規化（gouki_akuma → gouki, vega_mbison → mbison）
            normalized_slug = self._normalize_slug(slug)
            char_name = SLUG_TO_NAME.get(normalized_slug, slug)

            moves = []
            for raw in raw_moves:
                move = self._parse_move(raw)
                if move:
                    moves.append(move)

            classic_count = sum(1 for m in moves if m.command is not None)
            modern_count = sum(1 for m in moves if m.command_modern is not None)

            results[normalized_slug] = CharacterFrameDataV2(
                character_name=char_name,
                slug=normalized_slug,
                moves=moves,
            )

            logger.info(
                f"  {char_name:12s} — {len(moves)}技 "
                f"(Classic: {classic_count}, Modern: {modern_count})"
            )

        return results

    def _find_slug_var_mapping(self, js_content: str, known_vars: set[str]) -> dict[str, str]:
        """
        JS内の {alex:k,cviper:w,...,ryu:q} のようなオブジェクトを探し、
        スラッグ→変数名のマッピングを返す。
        """
        # known_varsを多く含むオブジェクトリテラルを探す
        best_mapping = {}

        for match in self.SLUG_MAP_PATTERN.finditer(js_content):
            pairs_str = match.group(1)
            pairs = {}
            for pair in pairs_str.split(","):
                if ":" in pair:
                    key, val = pair.split(":", 1)
                    pairs[key.strip()] = val.strip()

            # known_varsとの一致度で判定
            matched_vars = sum(1 for v in pairs.values() if v in known_vars)
            if matched_vars > len(best_mapping) * 0.5 and matched_vars >= 10:
                best_mapping = pairs

        return best_mapping

    def _normalize_slug(self, slug: str) -> str:
        """公式サイトのスラッグをアプリ内スラッグに変換"""
        # gouki_akuma → gouki, vega_mbison → mbison
        mapping = {
            "gouki_akuma": "gouki",
            "vega_mbison": "mbison",
        }
        return mapping.get(slug, slug)

    def _decode_json(self, raw_json: str) -> dict:
        """JSのエスケープされたJSON文字列をデコードする。

        JSチャンク内の日本語はUTF-8で直接埋め込まれている。
        JSのエスケープ（\\xNN, \\\\"等）を処理しつつ、日本語を壊さない。
        """
        # 1. \xNN → 対応するUnicode文字に変換
        decoded = re.sub(
            r'\\x([0-9a-fA-F]{2})',
            lambda m: chr(int(m.group(1), 16)),
            raw_json
        )

        # 2. \\" → \" に変換（JSの二重エスケープを解除）
        #    JSソース内では \\\" が「文字列中のクォート」を表す
        decoded = decoded.replace('\\\\"', '\\"')

        # 3. JSONで不正なエスケープ（\p, \N 等）をエスケープ解除
        #    JSON互換: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
        #    それ以外の \X は X に置換（バックスラッシュを除去）
        decoded = re.sub(
            r'\\([^"\\/bfnrtu])',
            r'\1',
            decoded
        )

        return json.loads(decoded)

    def _parse_move(self, raw: dict) -> MoveFrameData | None:
        """生のJSON辞書から1技分のデータをパース"""
        try:
            return MoveFrameData(
                web_id=str(raw.get("webId", "")),
                name=raw.get("name") or "",
                skill=raw.get("skill") or "",
                move_type=raw.get("type") or "",
                command=raw.get("command"),
                command_modern=raw.get("command_modern"),
                startup_frame=str(raw.get("startup_frame") or ""),
                active_frame=str(raw.get("active_frame") or ""),
                recovery_frame=str(raw.get("recovery_frame") or ""),
                total_frame=str(raw.get("frame") or ""),
                block_frame=str(raw.get("block_frame") or ""),
                hit_frame=str(raw.get("hit_frame") or ""),
                attribute=raw.get("attribute") or "",
                damage=str(raw.get("damage") or ""),
                combo_correct=raw.get("combo_correct") or [],
                cancel=raw.get("cancel") or "",
                web_cancel=raw.get("web_cancel") or "",
                drive_gauge_gain_hit=str(raw.get("drive_gauge_gain_hit") or ""),
                drive_gauge_gain_parry=str(raw.get("drive_gauge_gain_parry") or ""),
                drive_gauge_lose_dguard=str(raw.get("drive_gauge_lose_dguard") or ""),
                drive_gauge_lose_punish=str(raw.get("drive_gauge_lose_punish") or ""),
                sa_gauge_gain=str(raw.get("sa_gauge_gain") or ""),
                note=[n for n in (raw.get("note") or []) if n],  # null要素を除去
                translation=raw.get("translation") or "",
            )
        except Exception as e:
            logger.warning(f"技データのパースに失敗: {e} - {raw.get('skill', 'unknown')}")
            return None
