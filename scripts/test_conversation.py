#!/usr/bin/env python3
"""本番プロンプト(フレームデータ+ナレッジ注入)での会話品質テスト"""

import json
import time
import requests
from datetime import datetime
from pathlib import Path

BASE_URL = "http://localhost:3000"
OUTDIR = Path(__file__).parent / "test_results"
OUTDIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
RESULT_FILE = OUTDIR / f"conversation_test_{ts}.md"


def ask_api(messages: list, profile: dict, mode: str = "quick") -> str:
    """本番APIにリクエスト（SSEストリーミングを結合）"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chat",
            json={"messages": messages, "profile": profile, "mode": mode},
            headers={"Content-Type": "application/json"},
            stream=True,
            timeout=60,
        )
        if resp.status_code == 429:
            return "[ERROR: レート制限]"
        if resp.status_code != 200:
            return f"[ERROR: HTTP {resp.status_code}]"

        full_text = ""
        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            payload = line[6:].strip()
            if payload == "[DONE]":
                break
            try:
                data = json.loads(payload)
                if "chunk" in data:
                    full_text += data["chunk"]
                if "error" in data:
                    return f"[ERROR: {data['error']}]"
            except json.JSONDecodeError:
                pass

        # advice_meta JSONを除去
        import re
        full_text = re.sub(r'```json:advice_meta[\s\S]*?```', '', full_text).strip()
        return full_text
    except Exception as e:
        return f"[ERROR: {e}]"


def write(text: str):
    with open(RESULT_FILE, "a", encoding="utf-8") as f:
        f.write(text + "\n")


def run_conversation(title: str, profile: dict, turns: list[str], mode: str = "quick"):
    """複数往復の会話をシミュレート"""
    write(f"\n## {title}\n")
    write(f"プロフィール: {profile['mainCharacter']}/{profile['controlType']}/{profile['rank']}\n")
    print(f"\n=== {title} ===")

    messages = []
    for i, user_msg in enumerate(turns):
        messages.append({"role": "user", "content": user_msg})
        print(f"  [{i+1}/{len(turns)}] {user_msg[:50]}...")

        answer = ask_api(messages, profile, mode)
        messages.append({"role": "assistant", "content": answer})

        write(f"**User**: {user_msg}\n")
        write(f"**AI**: {answer}\n")
        write("---\n")
        time.sleep(3)


# ===== テスト定義 =====
write(f"# 会話品質テスト（本番プロンプト） — {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

# --- テスト1: ナレッジ豊富キャラ（テリー 1038件）× マスター帯ジェイミー ---
run_conversation(
    "テスト1: テリー対策（ナレッジ豊富）× マスター帯ジェイミー/CL",
    {"mainCharacter": "jamie", "controlType": "classic", "rank": "マスター"},
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
)

# --- テスト2: ナレッジ少ないキャラ（エレナ 129件）× マスター帯ジェイミー ---
run_conversation(
    "テスト2: エレナ対策（ナレッジ少なめ）× マスター帯ジェイミー/CL",
    {"mainCharacter": "jamie", "controlType": "classic", "rank": "マスター"},
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
)

# --- テスト3: ナレッジ豊富（リュウ 565件）× ゴールド帯リュウ/MO（初心者向け応答チェック） ---
run_conversation(
    "テスト3: 自キャラ質問 × ゴールド帯リュウ/MO（初心者向け応答）",
    {"mainCharacter": "ryu", "controlType": "modern", "rank": "ゴールド"},
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

# --- テスト4: ナレッジ少なめ（ダルシム 191件）× マスター帯ジェイミー ---
run_conversation(
    "テスト4: ダルシム対策（ナレッジ少なめ）× マスター帯ジェイミー/CL",
    {"mainCharacter": "jamie", "controlType": "classic", "rank": "マスター"},
    [
        "ダルシム戦つらい。近づけない",
        "テレポで逃げられるんだけど",
        "ダルシムの弾全部パリィしたほうがいい？",
        "フレイムガードした後の確反は？",
        "端に追い詰めたけど逃げられる",
        "ダルシム戦でジェイミーの酒飲むタイミングは？",
        "総合的にダルシム戦のゲームプラン教えて",
    ],
)

print(f"\n全テスト完了")
print(f"結果: {RESULT_FILE}")
