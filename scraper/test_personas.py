"""ペルソナ別AIコーチ対話テスト

10パターンのユーザーペルソナを作成し、
AIコーチAPIに実際にリクエストを送って応答品質を評価する。
"""

import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# アプリと同じプロンプト構築ロジックを再現するため、直接Gemini APIを叩く
from google import genai

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# --- ペルソナ定義 ---

PERSONAS = [
    {
        "id": 1,
        "name": "初心者リュウ",
        "desc": "格ゲー初めて1週間。リュウでランクマ始めたばかり",
        "profile": {
            "mainCharacter": "ryu",
            "controlType": "modern",
            "rank": "ルーキー",
            "weakAgainst": [],
            "challenges": ["コンボが繋がらない", "何をしていいかわからない"],
        },
        "chars": ["ryu"],
        "questions": [
            "リュウで最初に覚えるべきことは何ですか？",
            "モダン操作でおすすめのコンボを教えて",
        ],
    },
    {
        "id": 2,
        "name": "シルバー帯ジェイミー",
        "desc": "ジェイミーメインでシルバー帯。酔いレベルの上げ方がわからない",
        "profile": {
            "mainCharacter": "jamie",
            "controlType": "classic",
            "rank": "シルバー",
            "weakAgainst": ["jp", "dhalsim"],
            "challenges": ["酔いレベルが上がらない", "遠距離キャラに勝てない"],
        },
        "chars": ["jamie"],
        "questions": [
            "酔いレベルを安全に上げるコツを教えてほしい",
            "JP戦が本当にきつい。どうすればいい？",
        ],
    },
    {
        "id": 3,
        "name": "プラチナ帯ケン",
        "desc": "ケンで中級者。確反と対空が課題",
        "profile": {
            "mainCharacter": "ken",
            "controlType": "classic",
            "rank": "プラチナ",
            "weakAgainst": ["zangief", "manon"],
            "challenges": ["確反が安い", "対空が出ない"],
        },
        "chars": ["ken", "zangief"],
        "questions": [
            "ケンの確反始動で一番ダメージ取れるのは何？",
            "ザンギエフ戦の立ち回りを教えて。投げが怖い",
        ],
    },
    {
        "id": 4,
        "name": "ダイヤ帯春麗",
        "desc": "春麗でダイヤ。ドライブゲージ管理が課題",
        "profile": {
            "mainCharacter": "chunli",
            "controlType": "classic",
            "rank": "ダイヤモンド",
            "weakAgainst": ["cammy", "juri"],
            "challenges": ["ドライブゲージがすぐなくなる", "バーンアウトしがち"],
        },
        "chars": ["chunli", "cammy"],
        "questions": [
            "ドライブゲージの管理を改善したい。春麗でのコツは？",
            "キャミィの起き攻めがわからない。どう凌げばいい？",
        ],
    },
    {
        "id": 5,
        "name": "マスター帯豪鬼",
        "desc": "豪鬼MR1500。マッチアップ知識を深めたい",
        "profile": {
            "mainCharacter": "gouki",
            "controlType": "classic",
            "rank": "マスター",
            "masterRating": 1500,
            "weakAgainst": ["guile", "jp"],
            "challenges": ["弾キャラへの立ち回り", "体力が低くてワンミスで死ぬ"],
        },
        "chars": ["gouki", "guile"],
        "questions": [
            "ガイル戦のアプローチ方法を教えて。弾がきつい",
            "豪鬼の体力の低さをカバーするための立ち回りのコツは？",
        ],
    },
    {
        "id": 6,
        "name": "モダンJP使い",
        "desc": "モダンJPでゴールド帯。モダン特有の悩み",
        "profile": {
            "mainCharacter": "jp",
            "controlType": "modern",
            "rank": "ゴールド",
            "weakAgainst": ["rashid", "kimberly"],
            "challenges": ["モダンだとコマンド技が出しにくい", "近距離が弱い"],
        },
        "chars": ["jp"],
        "questions": [
            "モダンJPで覚えるべき必須テクニックは？",
            "近距離で攻められた時の切り返し方を教えて",
        ],
    },
    {
        "id": 7,
        "name": "復帰勢マリーザ",
        "desc": "スト5からの復帰。SF6のシステムがよくわからない",
        "profile": {
            "mainCharacter": "marisa",
            "controlType": "classic",
            "rank": "ブロンズ",
            "weakAgainst": [],
            "challenges": ["ドライブシステムが理解できない", "パリィのタイミング"],
        },
        "chars": ["marisa"],
        "questions": [
            "スト5から変わった重要なシステムを教えて",
            "ドライブインパクトはいつ使うべき？マリーザだと特に強い？",
        ],
    },
    {
        "id": 8,
        "name": "マスター帯エレナ",
        "desc": "エレナMR1800。新キャラの攻略情報がほしい",
        "profile": {
            "mainCharacter": "elena",
            "controlType": "classic",
            "rank": "マスター",
            "masterRating": 1800,
            "weakAgainst": ["aki"],
            "challenges": ["新キャラなので情報が少ない", "セットプレイの開拓"],
        },
        "chars": ["elena", "aki"],
        "questions": [
            "エレナのセットプレイで強いのはどれ？",
            "AKI戦の対策を教えて。毒が厄介",
        ],
    },
    {
        "id": 9,
        "name": "ゴールド帯ブランカ",
        "desc": "ブランカでゴールド止まり。伸び悩み中",
        "profile": {
            "mainCharacter": "blanka",
            "controlType": "classic",
            "rank": "ゴールド",
            "weakAgainst": ["guile", "dhalsim"],
            "challenges": ["ワンパターンになりがち", "待ちキャラに勝てない"],
        },
        "chars": ["blanka"],
        "questions": [
            "ブランカの立ち回りがワンパターンになる。どう改善すべき？",
            "ダルシム戦のアプローチ方法は？",
        ],
    },
    {
        "id": 10,
        "name": "マスター帯サガット",
        "desc": "サガットMR1600。Year3新キャラで情報が少ない",
        "profile": {
            "mainCharacter": "sagat",
            "controlType": "classic",
            "rank": "マスター",
            "masterRating": 1600,
            "weakAgainst": ["terry", "mai"],
            "challenges": ["Year3キャラの対策がわからない", "画面端からの脱出"],
        },
        "chars": ["sagat", "terry"],
        "questions": [
            "サガットの強みを活かした立ち回りを教えて",
            "テリー戦の注意点は？パワーダンクが見えない",
        ],
    },
]


def build_system_prompt(profile, char_slugs):
    """簡易版のシステムプロンプト構築（app側のロジックを再現）"""
    # フレームデータ読み込み
    frame_context = ""
    for slug in char_slugs[:3]:
        fpath = Path(__file__).parent.parent / "data" / "frame_data" / f"{slug}.json"
        if fpath.exists():
            data = json.loads(fpath.read_text())
            moves = data if isinstance(data, list) else data.get("moves", [])
            frame_context += f"\n## {slug} のフレームデータ（抜粋: 主要技のみ）\n"
            for m in moves[:15]:  # トークン節約で上位15技のみ
                name = m.get("skill", "")
                startup = m.get("startup_frame", "")
                block = m.get("block_frame", "")
                cancel = m.get("web_cancel", "不可")
                frame_context += f"- {name}: 発生{startup}F ガード{block} キャンセル:{cancel}\n"

    # ナレッジ読み込み
    knowledge_context = ""
    kdir = Path(__file__).parent.parent / "data" / "knowledge"
    entries = []
    for slug in char_slugs:
        kpath = kdir / f"{slug}.json"
        if kpath.exists():
            kdata = json.loads(kpath.read_text())
            entries.extend(kdata.get("entries", []))
    # 一般知識も追加
    gen_path = kdir / "general.json"
    if gen_path.exists():
        gdata = json.loads(gen_path.read_text())
        entries.extend(gdata.get("entries", []))

    if entries:
        knowledge_context = f"\n## プロ選手の知識（{len(entries)}件）\n"
        for e in entries[:10]:
            knowledge_context += f"- [{e['category']}] {e['topic']}: {e['content'][:100]}\n"
            knowledge_context += f"  — {e['source_channel']}（{e['source_timestamp']}）\n"

    # プロフィール
    profile_text = f"""メインキャラ: {profile['mainCharacter']}
操作タイプ: {profile['controlType']}
ランク: {profile['rank']}
{f"MR: {profile.get('masterRating', '')}" if profile.get('masterRating') else ""}
苦手: {', '.join(profile.get('weakAgainst', []))}
課題: {', '.join(profile.get('challenges', []))}"""

    return f"""あなたはSF6の専属AIコーチです。正確なフレームデータに基づいてアドバイスしてください。
フレームデータに記載がない内容は「確認が必要」と明示すること。

## プレイヤー情報
{profile_text}

## フレームデータ
{frame_context}

{knowledge_context}

日本語で簡潔に回答。"""


def simulate_conversation(persona):
    """ペルソナとの会話をシミュレーション"""
    print(f"\n{'='*60}")
    print(f"ペルソナ {persona['id']}: {persona['name']}")
    print(f"  {persona['desc']}")
    print(f"  キャラ: {persona['profile']['mainCharacter']}, ランク: {persona['profile']['rank']}")
    print(f"{'='*60}")

    sys_prompt = build_system_prompt(persona["profile"], persona["chars"])
    history = []

    results = []
    for q in persona["questions"]:
        print(f"\n👤 {q}")
        try:
            history.append({"role": "user", "parts": [{"text": q}]})
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[{"role": "user", "parts": [{"text": sys_prompt}]}] + history,
            )
            reply = response.text
            history.append({"role": "model", "parts": [{"text": reply}]})
            print(f"🤖 {reply[:500]}{'...' if len(reply) > 500 else ''}")
            results.append({
                "question": q,
                "reply": reply,
                "reply_length": len(reply),
            })
        except Exception as e:
            print(f"❌ エラー: {e}")
            results.append({
                "question": q,
                "reply": f"ERROR: {e}",
                "reply_length": 0,
            })

    return results


def main():
    all_results = {}
    for persona in PERSONAS:
        results = simulate_conversation(persona)
        all_results[persona["id"]] = {
            "name": persona["name"],
            "desc": persona["desc"],
            "results": results,
        }

    # 結果をJSONに保存
    out_path = Path(__file__).parent / "logs" / "persona_test_results.json"
    out_path.parent.mkdir(exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n結果を保存: {out_path}")


if __name__ == "__main__":
    main()
