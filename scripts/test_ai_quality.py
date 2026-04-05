#!/usr/bin/env python3
"""AI回答品質テスト: 直接Gemini APIを使用（レート制限回避）"""

import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime

# プロジェクトルート
PROJECT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_DIR / "scraper"))

# .env.localからAPI_KEYを読み込む
env_file = PROJECT_DIR / "app" / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

import google.generativeai as genai

API_KEY = os.environ.get("GOOGLE_API_KEY")
if not API_KEY:
    print("ERROR: GOOGLE_API_KEY not found")
    sys.exit(1)

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

# 結果ファイル
OUTDIR = PROJECT_DIR / "scripts" / "test_results"
OUTDIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
RESULT_FILE = OUTDIR / f"quality_test_{ts}.md"


def ask(question: str, main_char: str, control_type: str, rank: str) -> str:
    """簡易プロンプトでGeminiに質問"""
    prompt = f"""あなたはSF6の専属AIコーチです。
プレイヤー: {main_char}使い（{control_type}）、{rank}帯
ランク帯に応じた深さで回答。マスターなら基礎説明不要、具体的な戦術を。
3〜5行で簡潔に回答してください。

質問: {question}"""

    for attempt in range(5):
        try:
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) and attempt < 4:
                wait = 60 * (attempt + 1)
                print(f"    → レート制限。{wait}秒待機...")
                time.sleep(wait)
            else:
                return f"[ERROR: {e}]"
    return "[ERROR: リトライ上限]"


def write(text: str):
    with open(RESULT_FILE, "a", encoding="utf-8") as f:
        f.write(text + "\n")


# --- ペルソナ定義 ---
personas = [
    {
        "name": "マスター帯 ジェイミー/CL",
        "char": "jamie", "ct": "classic", "rank": "マスター",
        "questions": [
            "テリーのバーンナックル確反ある？",
            "ケンの迅雷ガードしたらどうする？",
            "ガイル戦の立ち回り教えて",
            "大ゴス確反ある？",
            "JPの弾対策どうすればいい？",
            "酔疾歩で弾抜けできる？",
            "起き攻めで投げと打撃のバランスどうしてる？",
            "ラシード戦で困ってるんだけど",
            "ドライブゲージ不利な時の立ち回りは？",
            "画面端の崩しパターン教えて",
        ],
    },
    {
        "name": "ゴールド帯 リュウ/MO",
        "char": "ryu", "ct": "modern", "rank": "ゴールド",
        "questions": [
            "対空が全然できないんだけど",
            "コンボが安定しない",
            "波動拳の使い方教えて",
            "ドライブインパクト返せない",
            "確反って何？",
            "起き攻めされると何もできない",
            "ラッシュからの攻めがわからない",
            "ザンギエフの投げがきつい",
            "大足のあとどうすればいい？",
            "SAゲージいつ使えばいい？",
        ],
    },
    {
        "name": "マスター帯 ケン/CL",
        "char": "ken", "ct": "classic", "rank": "マスター",
        "questions": [
            "迅雷の使い分け教えて",
            "ジェイミー戦きついんだけど",
            "画面端の起き攻めどうしてる？",
            "中足ラッシュ以外の崩しある？",
            "龍尾ガードされた後どうする？",
            "弾を撃つタイミングがわからん",
            "奮迅って実戦で使える？",
            "対空昇竜がよく落とされる",
            "バーンアウトした時の切り返しは？",
            "豪鬼戦の立ち回り",
        ],
    },
    {
        "name": "シルバー帯 キャミィ/MO",
        "char": "cammy", "ct": "modern", "rank": "シルバー",
        "questions": [
            "キャノンスパイクいつ使うの？",
            "ストライクの使い方教えて",
            "立ち回りで何をすればいい？",
            "フーリガンって使える？",
            "投げが多い相手にどうすればいい？",
            "モダンだと弱い技ある？",
            "アシストコンボだけでいい？",
            "ドライブラッシュの使い方",
            "本田戦どうすればいい？",
            "画面端に追い込まれたら",
        ],
    },
    {
        "name": "マスター帯 豪鬼/CL",
        "char": "gouki", "ct": "classic", "rank": "マスター",
        "questions": [
            "斬空の高度使い分けどうしてる？",
            "百鬼からの択の配分は？",
            "瞬獄殺いつ狙う？",
            "灼熱と通常波動の使い分け",
            "体力低いから守り重要だけどコツは？",
            "赤星の使いどころ",
            "春麗戦の立ち回り教えて",
            "阿修羅の使い方が下手なんだけど",
            "端の起き攻めで最大リターン取りたい",
            "弾対策された時どうする？",
        ],
    },
]

# --- 全キャラリスト ---
ALL_CHARS = [
    "ryu", "luke", "jamie", "chunli", "guile", "kimberly", "juri", "ken",
    "blanka", "dhalsim", "ehonda", "deejay", "manon", "marisa", "jp",
    "zangief", "lily", "cammy", "rashid", "aki", "ed", "gouki", "mbison",
    "terry", "mai", "elena", "cviper", "sagat", "alex",
]

# === メイン実行 ===
write(f"# AI回答品質テスト — {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

# --- ペルソナテスト ---
total = 0
for p in personas:
    write(f"\n## {p['name']}\n")
    print(f"\n=== {p['name']} ===")
    for q in p["questions"]:
        total += 1
        print(f"  [{total}/50] {q}")
        answer = ask(q, p["char"], p["ct"], p["rank"])
        write(f"### Q: {q}\n{answer}\n")
        time.sleep(1)

print(f"\nペルソナテスト完了: {total}問\n")

# --- 全キャラ精度チェック ---
write("\n## 全キャラ精度チェック（29キャラ × 2操作タイプ）\n")
print("=== 全キャラ精度チェック ===")
char_total = 0
for char in ALL_CHARS:
    for ct in ["classic", "modern"]:
        char_total += 1
        print(f"  [{char_total}/58] {char}/{ct[:2]}")
        answer = ask("このキャラの強みと基本戦術を短く教えて", char, ct, "ダイヤ")
        write(f"### {char} ({ct})\n{answer}\n")
        time.sleep(1)

print(f"\n全テスト完了: ペルソナ{total}問 + キャラ{char_total}パターン")
print(f"結果: {RESULT_FILE}")
