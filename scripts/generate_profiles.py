#!/usr/bin/env python3
"""全29キャラの攻略プロフィールを自動生成（Vertex AI）"""

import os
os.environ["GRPC_DNS_RESOLVER"] = "native"

import json
import time
import subprocess
from pathlib import Path
from datetime import datetime

PROJECT_DIR = Path(__file__).parent.parent
DATA_DIR = PROJECT_DIR / "data"
KNOWLEDGE_DIR = DATA_DIR / "knowledge"
PROFILE_DIR = KNOWLEDGE_DIR / "_profiles"
PROFILE_DIR.mkdir(exist_ok=True)

# Vertex AI セットアップ
PROJECT_ID = subprocess.check_output(
    ["gcloud", "config", "get-value", "project"], text=True
).strip()

import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project=PROJECT_ID, location="us-central1")
model = GenerativeModel("gemini-2.5-flash")

# キャラリスト
CHARS = [
    "ryu", "luke", "jamie", "chunli", "guile", "kimberly", "juri", "ken",
    "blanka", "dhalsim", "ehonda", "deejay", "manon", "marisa", "jp",
    "zangief", "lily", "cammy", "rashid", "aki", "ed", "gouki", "mbison",
    "terry", "mai", "elena", "cviper", "sagat", "alex",
]

CHAR_JP = {
    "ryu": "リュウ", "luke": "ルーク", "jamie": "ジェイミー", "chunli": "春麗",
    "guile": "ガイル", "kimberly": "キンバリー", "juri": "ジュリ", "ken": "ケン",
    "blanka": "ブランカ", "dhalsim": "ダルシム", "ehonda": "本田", "deejay": "ディージェイ",
    "manon": "マノン", "marisa": "マリーザ", "jp": "JP", "zangief": "ザンギエフ",
    "lily": "リリー", "cammy": "キャミィ", "rashid": "ラシード", "aki": "A.K.I.",
    "ed": "エド", "gouki": "豪鬼", "mbison": "ベガ", "terry": "テリー",
    "mai": "舞", "elena": "エレナ", "cviper": "C.ヴァイパー", "sagat": "サガット",
    "alex": "アレックス",
}

# フレームデータslug→ナレッジslug変換
FRAME_TO_KNOWLEDGE = {"ehonda": "honda"}


def load_frame_data(slug: str) -> dict | None:
    fp = DATA_DIR / "frame_data" / f"{slug}.json"
    if not fp.exists():
        return None
    return json.load(open(fp))


def load_digest(slug: str) -> str:
    knowledge_slug = FRAME_TO_KNOWLEDGE.get(slug, slug)
    manifest_path = KNOWLEDGE_DIR / "_digests" / "_manifest.json"
    if not manifest_path.exists():
        return ""
    manifest = json.load(open(manifest_path))
    info = manifest.get("digests", {}).get(knowledge_slug)
    if not info:
        return ""
    digest_path = KNOWLEDGE_DIR / "_digests" / info["file"]
    if not digest_path.exists():
        return ""
    return digest_path.read_text()[:4000]


def load_knowledge_count(slug: str) -> int:
    knowledge_slug = FRAME_TO_KNOWLEDGE.get(slug, slug)
    fp = KNOWLEDGE_DIR / f"{knowledge_slug}.json"
    if not fp.exists():
        return 0
    data = json.load(open(fp))
    return len(data.get("entries", []))


def summarize_frame_data(data: dict) -> str:
    """フレームデータから主要技を抽出"""
    lines = []
    for m in data["moves"]:
        if m.get("move_type") not in ("NORMAL", "SPECIAL", "SA", "SUPER"):
            continue
        note = m.get("note", [])
        note_str = f" [{', '.join(note)}]" if note else ""
        lines.append(
            f"{m['skill']}: 発生{m['startup_frame']}F ガード{m['block_frame']} "
            f"ヒット{m['hit_frame']} ダメージ{m['damage']}{note_str}"
        )
    return "\n".join(lines)


def generate_profile(slug: str) -> str:
    """1キャラ分のプロフィールを生成"""
    jp_name = CHAR_JP.get(slug, slug)
    frame_data = load_frame_data(slug)
    digest = load_digest(slug)
    knowledge_count = load_knowledge_count(slug)

    frame_summary = summarize_frame_data(frame_data) if frame_data else "（フレームデータなし）"

    prompt = f"""あなたはSF6の攻略エキスパートです。以下のデータに基づいて、{jp_name}の攻略プロフィールを作成してください。

## 出力フォーマット（厳守）
以下のフォーマットで正確に出力してください。各項目は指定の文字数以内に収めてください。

強み: （50-80文字。このキャラが得意なこと2-3個を簡潔に）
弱み: （50-80文字。このキャラの弱点2-3個を簡潔に）
キー技: （主要な技を5個、技名とフレーム値付きで1行ずつ。フレームデータから正確に引用すること）
基本戦術: （80-120文字。このキャラの基本的な勝ち方を3行程度で）
SA情報: （SA1-SA3の名前と主な用途を各1行で。フレームデータのSA/SUPER技から引用）

## ルール
- フレームデータに記載されている数値のみを使うこと。推測で数値を書かない
- 備考欄（[]内）の情報（無敵フレーム等）があれば必ず含める
- 「〜しましょう」等の指導口調は不要。事実と特徴を端的に記述する
- 日本語で出力する

## {jp_name}のフレームデータ
{frame_summary}

## {jp_name}のダイジェスト（プロ知識要約）
{digest if digest else "（ナレッジ少なめ。フレームデータベースで作成すること）"}

ナレッジ件数: {knowledge_count}件
"""

    for attempt in range(3):
        try:
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                print(f"    → レート制限。60秒待機...")
                time.sleep(60)
            else:
                return f"[ERROR: {e}]"
    return "[ERROR: リトライ上限]"


# ===== メイン実行 =====
print(f"=== 全{len(CHARS)}キャラ攻略プロフィール生成 ===\n")

all_profiles = {}
for i, slug in enumerate(CHARS):
    jp_name = CHAR_JP.get(slug, slug)
    print(f"[{i+1}/{len(CHARS)}] {jp_name} ({slug})...")

    profile_text = generate_profile(slug)
    all_profiles[slug] = {
        "name": jp_name,
        "slug": slug,
        "profile": profile_text,
        "generated_at": datetime.now().isoformat(),
    }

    # 個別ファイルに保存
    profile_path = PROFILE_DIR / f"{slug}.md"
    profile_path.write_text(f"# {jp_name}\n\n{profile_text}\n", encoding="utf-8")

    time.sleep(3)

# 統合JSONも保存
manifest_path = PROFILE_DIR / "_manifest.json"
json.dump(all_profiles, open(manifest_path, "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

print(f"\n=== 完了 ===")
print(f"個別ファイル: {PROFILE_DIR}/*.md")
print(f"マニフェスト: {manifest_path}")
