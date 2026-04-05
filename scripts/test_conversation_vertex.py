#!/usr/bin/env python3
"""本番相当プロンプトでの会話品質テスト（Vertex AI直接）"""

import os
# gRPCのDNSリゾルバをOS標準に切替（c-aresがmacOSで失敗する問題の回避）
os.environ["GRPC_DNS_RESOLVER"] = "native"

import json
import sys
import time
import re
import subprocess
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_DIR / "app" / "src"))

OUTDIR = PROJECT_DIR / "scripts" / "test_results"
OUTDIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
RESULT_FILE = OUTDIR / f"conv_vertex_{ts}.md"

# Vertex AI セットアップ
PROJECT_ID = subprocess.check_output(
    ["gcloud", "config", "get-value", "project"], text=True
).strip()

import vertexai
from vertexai.generative_models import GenerativeModel, Content, Part

vertexai.init(project=PROJECT_ID, location="us-central1")
model = GenerativeModel("gemini-2.5-flash")

# --- ナレッジ・フレームデータ読み込み ---
DATA_DIR = PROJECT_DIR / "data"
KNOWLEDGE_DIR = DATA_DIR / "knowledge"

def load_frame_data(slug: str) -> str:
    """フレームデータをテキスト化（本番formatFrameDataForContext相当）"""
    fp = DATA_DIR / "frame_data" / f"{slug}.json"
    if not fp.exists():
        return ""
    data = json.load(open(fp))
    lines = [f"## {data['character_name']} のフレームデータ\n"]
    for m in data["moves"]:
        if m.get("move_type") not in ("NORMAL", "SPECIAL", "SA"):
            continue
        cmd = m.get("command") or ""
        cancel = m.get("web_cancel", "")
        note_list = m.get("note", [])
        note_str = f" [{' / '.join(note_list)}]" if note_list else ""
        lines.append(
            f"- {m['skill']} ({cmd}): 発生{m['startup_frame']}F "
            f"ガード{m['block_frame']} ヒット{m['hit_frame']} "
            f"ダメージ{m['damage']} {m['attribute']} キャンセル:{cancel}{note_str}"
        )
    return "\n".join(lines)

def load_digest(slug: str) -> str:
    """ダイジェスト読み込み"""
    # ehonda → honda 変換
    knowledge_slug = "honda" if slug == "ehonda" else slug
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
    content = digest_path.read_text()
    # 5000文字で切り詰め
    if len(content) > 5000:
        content = content[:5000] + "\n...（省略）"
    return content

# --- システムプロンプト読み込み（prompts.tsの内容を再現） ---
PROMPTS_FILE = PROJECT_DIR / "app" / "src" / "lib" / "prompts.ts"
# prompts.tsからシステムプロンプトのテキスト部分を抽出するのは複雑なので、
# 核心部分を直接記述する

def build_system_prompt(main_char: str, control_type: str, rank: str,
                        frame_data: str, digest: str, opponent_frame_data: str = "") -> str:
    return f"""あなたはストリートファイター6（SF6）の専属AIコーチです。
担当プレイヤーの実力向上を最優先に、実戦で即使えるアドバイスを提供してください。

## コーチングのスタイル
- 1回の回答は最大5〜8行。1つの質問に1〜2個のポイントに絞る
- アドバイス後に「質問」「確認」「提案」のいずれかで終える

### ランク帯対応
- マスター帯: 基礎は全て知っている前提。「確反を入れましょう」「対空を意識」等は不要。
  具体的な確反レシピ、状況別の択構成、相手のクセへの対応を話す。
- ダイヤ帯以下: 基礎の定着が最優先。

### マスター帯プレイヤーへの回答品質ガイド
マスター帯に言うな: 「確反を入れましょう」「対空を意識」「ガードしたら反撃」
代わりに言うべき: 具体的なレシピ、状況判断、読み合いの枠組み

## 最重要ルール：正確性の担保
- 技の性能について必ずフレームデータを確認してから回答
- フレームデータの備考欄（[]内）に「飛び道具に対して無敵」等の記載がない技を弾抜けとして紹介しない
- フレームデータにない性能を断定しない。不確かなら「確認が必要」と言う

## 俗称の理解
- 「大ゴス」→ リュウの6+強P（鳩尾砕き）
- 「鎖骨」→ リュウの鎖骨割り（6+中P）
- 「昇竜」→ 昇龍拳系の対空無敵技全般
- 「波動」→ 飛び道具全般
- 「生ラッシュ」→ ニュートラルからのドライブラッシュ
- 「キャンラ」→ キャンセルラッシュ
- 「シミー」→ 投げ抜けを誘って後ろ歩きでスカし確反
- 「暴れ」→ 不利状況で打撃を出す
- 「ぶっぱ」→ リスク無視で大技を出す
- 「ヒッ確」→ ヒット確認
- 「バクステ」→ バックステップ

## プレイヤー情報
メインキャラ: {main_char}（{control_type}）、{rank}帯

## {main_char}のキャラ知識（ダイジェスト）
{digest}

## 参照フレームデータ
{frame_data}
{opponent_frame_data}
"""


def ask(system_prompt: str, messages: list) -> str:
    """Vertex AIで会話"""
    contents = [Content(role="user", parts=[Part.from_text(system_prompt + "\n\n以下の会話に応答してください。")])]

    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(Content(role=role, parts=[Part.from_text(msg["content"])]))

    try:
        response = model.generate_content(contents)
        text = response.text.strip()
        # advice_meta除去
        text = re.sub(r'```json:advice_meta[\s\S]*?```', '', text).strip()
        return text
    except Exception as e:
        if "429" in str(e):
            print(f"    → レート制限。60秒待機...")
            time.sleep(60)
            try:
                response = model.generate_content(contents)
                return re.sub(r'```json:advice_meta[\s\S]*?```', '', response.text.strip()).strip()
            except Exception as e2:
                return f"[ERROR: {e2}]"
        return f"[ERROR: {e}]"


def write(text: str):
    with open(RESULT_FILE, "a", encoding="utf-8") as f:
        f.write(text + "\n")


def run_conversation(title: str, main_char: str, control_type: str, rank: str,
                     turns: list, opponent_char: str = None):
    """複数往復会話テスト"""
    write(f"\n## {title}\n")
    print(f"\n=== {title} ===")

    frame_data = load_frame_data(main_char)
    digest = load_digest(main_char)
    opp_frame = load_frame_data(opponent_char) if opponent_char else ""

    system_prompt = build_system_prompt(main_char, control_type, rank, frame_data, digest, opp_frame)

    messages = []
    for i, user_msg in enumerate(turns):
        messages.append({"role": "user", "content": user_msg})
        print(f"  [{i+1}/{len(turns)}] {user_msg[:50]}...")

        answer = ask(system_prompt, messages)
        messages.append({"role": "assistant", "content": answer})

        write(f"**User**: {user_msg}\n")
        write(f"**AI**: {answer}\n")
        write("---\n")
        time.sleep(4)


# ===== テスト実行 =====
write(f"# 会話品質テスト（本番相当・Vertex AI） — {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

# テスト1: テリー対策（ナレッジ豊富1038件）× マスター帯ジェイミー
run_conversation(
    "テスト1: テリー対策（ナレッジ豊富）× マスター帯ジェイミー/CL",
    "jamie", "classic", "マスター",
    [
        "テリーのバーンナックル確反ある？",
        "OD版はどう？先端ガードだと届かない気がするんだけど",
        "パワーウェイブ対策はどうすればいい？",
        "酔疾歩で弾抜けできる？",
        "テリーの起き攻め拒否したい。ライジング重ねてくるんだけど",
        "クラックシュートガードした後って確反ある？",
        "テリー戦のドライブゲージ管理教えて",
        "端に追い詰められた時の脱出方法は？",
        "テリーのSA3対策は？",
        "総合的にテリー戦で意識すべきこと3つ教えて",
    ],
    opponent_char="terry",
)

# テスト2: エレナ対策（ナレッジ少なめ129件）× マスター帯ジェイミー
run_conversation(
    "テスト2: エレナ対策（ナレッジ少なめ）× マスター帯ジェイミー/CL",
    "jamie", "classic", "マスター",
    [
        "エレナ戦の立ち回りどうすればいい？",
        "エレナのリンクスティングってガードしたらどうする？",
        "ヒーリングされるのきつい。止める方法ある？",
        "エレナのめくりが見えない",
        "エレナの起き攻めどう拒否する？",
        "端でのエレナの崩しがきつい",
        "エレナ戦でジェイミー側が有利な場面は？",
        "総合的にエレナ戦で意識すべきこと3つ教えて",
    ],
    opponent_char="elena",
)

# テスト3: 自キャラ質問 × ゴールド帯リュウ/MO
run_conversation(
    "テスト3: 自キャラ質問 × ゴールド帯リュウ/MO",
    "ryu", "modern", "ゴールド",
    [
        "波動拳ばっかり撃ってるけど飛ばれる。どうすればいい？",
        "昇竜拳が出ない時がある。コツは？",
        "大ゴス確反ある？",
        "中足からのコンボ教えて",
        "起き攻めが全然わからない",
        "ドライブインパクトいつ使えばいい？",
        "ケン戦で何すればいい？",
        "ラッシュからの攻め方教えて",
    ],
)

# テスト4: ダルシム対策（ナレッジ少なめ）× マスター帯ジェイミー
run_conversation(
    "テスト4: ダルシム対策（ナレッジ少なめ）× マスター帯ジェイミー/CL",
    "jamie", "classic", "マスター",
    [
        "ダルシム戦つらい。近づけない",
        "テレポで逃げられるんだけど",
        "ダルシムの弾全部パリィしたほうがいい？",
        "フレイムガードした後の確反は？",
        "端に追い詰めたけど逃げられる",
        "ダルシム戦でジェイミーの酒飲むタイミングは？",
        "総合的にダルシム戦のゲームプラン教えて",
    ],
    opponent_char="dhalsim",
)

print(f"\n全テスト完了")
print(f"結果: {RESULT_FILE}")
