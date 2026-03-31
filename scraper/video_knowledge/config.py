"""パイプライン設定: 信頼チャンネル、検索クエリ、キーワード辞書、API制限"""

from dataclasses import dataclass, field
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# --- 信頼チャンネル（Sランク: 手動登録） ---

TRUSTED_CHANNELS: dict[str, dict] = {
    # === Sランク: プロ選手・主要攻略チャンネル ===
    "なるお": {
        "handle": "", "trust_rank": "S", "trust_score": 1.0,
        "note": "ジェイミー使い。攻略情報が豊富",
    },
    "ぷげら": {
        "handle": "", "trust_rank": "S", "trust_score": 1.0,
        "note": "多キャラ攻略講座。エレナ・サガット・エド等",
    },
    "カワノ": {
        "handle": "", "trust_rank": "S", "trust_score": 1.0,
        "note": "地上戦・座学解説。豪鬼・ルーク等",
    },
    "でぃぃち": {
        "handle": "", "trust_rank": "S", "trust_score": 1.0,
        "note": "モダン操作解説。18キャラカバーで偏り解消に貢献",
    },
    "ACQUA": {
        "handle": "", "trust_rank": "S", "trust_score": 1.0,
        "note": "初心者向け講座。JP・ベガ・キンバリー等11キャラ",
    },
    "SmashlogTV": {
        "handle": "", "trust_rank": "S", "trust_score": 1.0,
        "note": "ハイタニ・竹内ジョン等プロの解説。高品質",
    },
    # === Aランク: プロ選手・信頼できる攻略チャンネル ===
    "スト6初心者応援チャンネル": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "キャラ対策特化。10キャラカバー",
    },
    "どぐら": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "プロ選手。ディージェイ・舞の解説",
    },
    "マゴ": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "トッププロ。キャミィ・ジュリの簡潔な解説",
    },
    "ストーム久保": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "本田・ブランカ・アレックス。エンタメ+攻略",
    },
    "ふ〜ど": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "プロ選手。コーチング形式の解説が多い",
    },
    # === Aランク: キャラ専門チャンネル ===
    "GANAKEN": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "LEGEND帯マノン使い。マノン講座が充実",
    },
    "りゅうせい": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "JP・ディージェイの網羅講座",
    },
    "いおりチャンネル": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "ブランカ・テリー・バイパーの講座",
    },
    "ずんだもんふぁいたー": {
        "handle": "", "trust_rank": "A", "trust_score": 0.8,
        "note": "アレックス・バイパー・テリーの解説",
    },
}


# --- キャラクター日本語名マッピング（検索クエリ用） ---

CHARACTER_JP_NAMES: dict[str, str] = {
    "ryu": "リュウ",
    "luke": "ルーク",
    "jamie": "ジェイミー",
    "chunli": "春麗",
    "guile": "ガイル",
    "kimberly": "キンバリー",
    "juri": "ジュリ",
    "ken": "ケン",
    "blanka": "ブランカ",
    "dhalsim": "ダルシム",
    "honda": "本田",
    "deejay": "ディージェイ",
    "manon": "マノン",
    "marisa": "マリーザ",
    "jp": "JP",
    "zangief": "ザンギエフ",
    "lily": "リリー",
    "cammy": "キャミィ",
    "rashid": "ラシード",
    "aki": "アキ",
    "ed": "エド",
    "gouki": "豪鬼",
    "mbison": "ベガ",
    "terry": "テリー",
    "mai": "舞",
    "elena": "エレナ",
    "cviper": "バイパー",
    "sagat": "サガット",
    "alex": "アレックス",
}


# --- 検索クエリテンプレート ---
# 「解説」「攻略」等の教育的キーワードを必ず含めて、対戦実況の混入を防ぐ

SEARCH_QUERY_TEMPLATES: list[str] = [
    # キャラ別攻略
    "SF6 {char_jp} 解説 攻略",
    "SF6 {char_jp} 対策 立ち回り",
    "SF6 {char_jp} コンボ 解説",
    "SF6 {char_jp} 起き攻め 攻略",
    # マッチアップ
    "SF6 {char_jp} {opponent_jp} 対策",
    # 一般攻略
    "SF6 座学 フレーム 解説",
    "スト6 初心者 上達 攻略",
]

# コーチング動画検索クエリ
COACHING_QUERY_TEMPLATES: list[str] = [
    "SF6 コーチング",
    "スト6 コーチング",
    "SF6 coaching",
    "SF6 コーチング 初心者",
    "SF6 コーチング ゴールド",
    "SF6 コーチング マスター",
    "SF6 {char_jp} コーチング",
]

# ギャップクエリ生成用テンプレート
GAP_QUERY_TEMPLATES: list[str] = [
    "SF6 {char_jp} {topic_jp} 解説",
    "SF6 {char_jp} {topic_jp} 攻略",
]

# カテゴリの日本語マッピング（ギャップクエリ用）
CATEGORY_JP_NAMES: dict[str, str] = {
    "matchup": "対策",
    "combo": "コンボ",
    "neutral": "立ち回り",
    "oki": "起き攻め",
    "defense": "防御",
    "general": "攻略",
}


# --- 信頼性評価キーワード ---

# 講座系キーワード（これが含まれていないと「講座ではない」と判定される）
# 少なくとも1つは含まれている必要がある
TUTORIAL_INDICATORS: list[str] = [
    # 日本語: 講座・解説系
    "解説", "攻略", "対策", "講座", "コンボ", "立ち回り", "起き攻め",
    "座学", "テクニック", "使い方", "始め方",
    "コーチング", "coaching", "コーチ", "指導", "アドバイス",
    "確反", "セットプレイ", "連携", "崩し", "差し返し", "対空",
    "初心者", "上達", "上級者", "フレーム",
    # 英語
    "guide", "tutorial", "tips", "how to", "explained", "breakdown",
    "combo", "matchup", "gameplan", "fundamentals",
]

# 強い除外キーワード（これが含まれていたら講座系キーワードがあっても弾く）
HARD_EXCLUDE_KEYWORDS: list[str] = [
    # ティアリスト・ランキング系（主観的で偏った情報源）
    "ティアリスト", "tier list", "tierlist", "ティア表",
    "ランキング", "ranking", "最強キャラ", "強キャラ",
    # パッチノート・アップデート感想系
    "パッチノート", "patch note", "アプデ感想", "調整内容",
    "弱体化", "強化された", "ナーフ",
    # 対戦実況・配信系
    "配信アーカイブ", "ライブ配信", "LIVE配信",
    "ランクマ配信", "ランクマッチ配信",
    # エンタメ・ネタ系
    "煽り", "ネタ", "面白", "おもしろ", "爆笑",
    "compilation", "highlights", "funny", "rage", "montage",
    # その他ノイズ
    "reaction", "反応", "プロの反応", "衝撃",
    "開封", "ガチャ", "コラボ",
]

# 弱い減点キーワード（講座系キーワードがあれば通過可だが減点）
SOFT_NEGATIVE_KEYWORDS: list[str] = [
    "ランクマッチ", "ランクマ", "配信", "切り抜き",
    "stream", "LIVE", "まとめ",
    "最強", "無双", "ボコ", "ボコボコ",
    "衝撃の", "驚愕", "やばい", "ヤバい",
]

# 除外パターン（正規表現。マッチしたら即スキップ — チャンネルランク問わず）
EXCLUDE_PATTERNS: list[str] = [
    r"#shorts",
    r"配信アーカイブ",
    r"LIVE.*アーカイブ",
    r"アーカイブ.*LIVE",
    r"\d+時間.*配信",
    r"tier\s*list",
    r"ティアリスト",
]


# --- 信頼性スコアの重み ---
# 動画種別の比重を上げて、チャンネル信頼度だけで通過しないようにする
CREDIBILITY_WEIGHTS = {
    "channel_trust": 0.35,   # チャンネル信頼度
    "video_type": 0.45,      # 動画種別スコア（最重要）
    "popularity": 0.20,      # 再生回数
}

# 信頼スコア閾値
CREDIBILITY_THRESHOLD_HIGH = 0.7     # INVESTIGATE スキップ可
CREDIBILITY_THRESHOLD_LOW = 0.4      # これ未満はスキップ

# 動画種別スコアの最低ライン（チャンネルランク問わず、これ未満は強制スキップ）
VIDEO_TYPE_MINIMUM = 0.4

# Aランク自動判定の登録者数閾値
AUTO_A_RANK_SUBSCRIBER_THRESHOLD = 10_000


# --- パイプライン設定 ---

@dataclass
class PipelineConfig:
    """パイプライン全体の設定"""
    # パス設定
    root_dir: Path = Path(__file__).parent.parent.parent
    data_dir: Path = root_dir / "data"
    knowledge_dir: Path = data_dir / "knowledge"
    frame_data_dir: Path = data_dir / "frame_data"

    # Gemini API設定
    google_api_key: str = field(
        default_factory=lambda: os.getenv("GOOGLE_API_KEY", "")
    )
    gemini_model: str = "gemini-2.5-flash"

    # Vertex AI設定（Cloud Consoleのクレジットを使う場合）
    use_vertex_ai: bool = field(
        default_factory=lambda: os.getenv("USE_VERTEX_AI", "").lower() in ("true", "1", "yes")
    )
    vertex_project: str = field(
        default_factory=lambda: os.getenv("VERTEX_PROJECT", "")
    )
    vertex_location: str = field(
        default_factory=lambda: os.getenv("VERTEX_LOCATION", "us-central1")
    )

    # レートリミット（Vertex AIは大幅緩和: RPM 2000, トークン制限なし）
    rpm_limit: int = 15               # リクエスト/分
    request_interval_sec: float = 5.0  # API呼び出し間隔（秒）
    daily_request_limit: int = 1000    # 日次リクエスト上限
    daily_video_minutes: int = 480     # 日次動画時間上限（8時間 = 480分）

    # DISCOVER設定
    search_results_per_query: int = 20  # 1クエリあたりの検索結果数
    min_duration_sec: int = 120         # 最短2分
    max_duration_sec: int = 3600        # 最長60分

    # INVESTIGATE設定
    min_knowledge_density: float = 0.3  # 知識密度の閾値

    def __post_init__(self):
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)
