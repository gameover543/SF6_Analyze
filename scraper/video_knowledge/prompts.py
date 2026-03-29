"""LLMプロンプトテンプレート: INVESTIGATE・EXECUTE用"""

from .config import CHARACTER_JP_NAMES

# キャラslug一覧（プロンプト埋め込み用）
_SLUG_LIST = ", ".join(sorted(CHARACTER_JP_NAMES.keys()))

_SLUG_MAP_LINES = "\n".join(
    f"  {jp} → {slug}" for slug, jp in CHARACTER_JP_NAMES.items()
)


# --- INVESTIGATE: 動画内容の精査 ---

INVESTIGATE_PROMPT = f"""あなたはSF6（ストリートファイター6）の動画分析エキスパートです。
この動画を分析し、以下をJSON形式のみで回答してください（説明文不要）。

## 判定基準
- "is_tutorial": この動画は視聴者に技術・知識を教える解説動画ですか？
  - true: 攻略解説、対策解説、コンボ解説、座学、キャラ紹介 等
  - false: ただの対戦実況、クリップ集、ネタ動画、配信切り抜き、煽り動画 等
- "knowledge_density": 具体的な攻略アドバイス（技の使い方、フレーム、対策、状況判断等）の密度
  - 1.0: 全編にわたって具体的な知識を解説
  - 0.5: 半分程度は解説だが雑談や実演も混在
  - 0.0: 攻略知識がほぼない

## キャラクター名→slug対応表
{_SLUG_MAP_LINES}

## 出力形式（JSONのみ）
{{
  "is_tutorial": true/false,
  "knowledge_density": 0.0〜1.0,
  "characters": ["slug1", "slug2"],
  "topics": ["matchup", "combo", "neutral", "oki", "defense", "general"],
  "summary": "30字以内の要約"
}}"""


# --- EXECUTE: 知識抽出 ---

EXTRACTION_PROMPT = f"""あなたはSF6（ストリートファイター6）の知識抽出エージェントです。
この動画から、実戦で役立つ具体的な知識をすべて抽出してください。

## 抽出ルール
- 具体的なアドバイスのみ抽出すること（「頑張りましょう」「練習しよう」のような一般論は除外）
- 各知識に必ず「どのキャラの」「どの状況で」「何をすべきか」を含めること
- 技名やフレーム数値が言及されていれば必ず含めること
- 元の発言をsource_quoteとして日本語でそのまま保持すること
- タイムスタンプをMM:SS形式で記録すること（正確な秒数が不明な場合は概算でOK）
- 同じ話題の繰り返しは1つにまとめること
- 言及された技名は正式名称（立ち弱P、しゃがみ中K、昇龍拳等）で記録すること
- referenced_move_namesフィールドに、知識で言及されている全ての技名をリストすること

## カテゴリ定義
- matchup: 特定キャラへの対策・マッチアップ知識
- combo: コンボルート・コンボレシピ
- neutral: 立ち回り・間合い管理・差し合い
- oki: 起き攻め・セットプレイ・攻め継続
- defense: 防御・切り返し・暴れ・ドライブ管理
- general: 上記に当てはまらない一般的な攻略知識

## キャラクター名→slug対応表
{_SLUG_MAP_LINES}

## 出力形式（JSON配列のみ。説明文不要）
[
  {{
    "category": "matchup|combo|neutral|oki|defense|general",
    "topic": "トピックの要約（20字以内）",
    "content": "具体的なアドバイス内容（できるだけ詳細に）",
    "characters": ["slug1"],
    "matchup": "opponent_slug（マッチアップ知識の場合）またはnull",
    "situation": "状況（画面端、起き攻め、ドライブゲージ少ない時 等）またはnull",
    "source_quote": "動画内での元の発言をそのまま引用",
    "source_timestamp": "MM:SS",
    "referenced_move_names": ["立ち弱P", "弱酔疾歩"]
  }}
]

知識が見つからない場合は空の配列 [] を返してください。"""
