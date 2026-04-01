"""コーチ応答品質のA/Bテストベンチマーク

同じ質問に対して異なるプロンプト/ナレッジ設定（バリアント）で応答を生成し、
LLM評価（正確性・実用性・フレームデータ引用の正しさ）で比較する。

使い方:
  cd scraper && python ab_benchmark.py
  cd scraper && python ab_benchmark.py --variants baseline,no_knowledge
  cd scraper && python ab_benchmark.py --cases bm_01 bm_03
  cd scraper && python ab_benchmark.py --skip-eval   # 応答生成のみ（評価なし）
"""

import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from google import genai

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# --- ベンチマーク質問セット ---
# フレームデータ引用テスト・ナレッジ活用テスト・システム知識テストを網羅

BENCHMARK_CASES = [
    {
        "id": "bm_01",
        "desc": "ジェイミー: 酔いレベルの安全な上げ方（ナレッジ活用テスト）",
        "profile": {
            "mainCharacter": "jamie",
            "controlType": "classic",
            "rank": "シルバー",
            "weakAgainst": ["jp", "dhalsim"],
            "challenges": ["酔いレベルが上がらない", "遠距離キャラに勝てない"],
        },
        "chars": ["jamie"],
        "question": "酔いレベルを安全に上げるコツを教えてほしい",
    },
    {
        "id": "bm_02",
        "desc": "ケン: 確反始動のフレーム引用テスト",
        "profile": {
            "mainCharacter": "ken",
            "controlType": "classic",
            "rank": "プラチナ",
            "weakAgainst": ["zangief", "manon"],
            "challenges": ["確反が安い"],
        },
        "chars": ["ken"],
        "question": "ケンの確反始動で一番ダメージ取れるのは何？発生フレームも教えて",
    },
    {
        "id": "bm_03",
        "desc": "春麗: ドライブゲージ管理（システム知識テスト）",
        "profile": {
            "mainCharacter": "chunli",
            "controlType": "classic",
            "rank": "ダイヤモンド",
            "weakAgainst": ["cammy"],
            "challenges": ["ドライブゲージがすぐなくなる"],
        },
        "chars": ["chunli"],
        "question": "ドライブゲージの管理を改善したい。春麗でのコツは？",
    },
    {
        "id": "bm_04",
        "desc": "豪鬼: 弾キャラ対策（対戦知識テスト）",
        "profile": {
            "mainCharacter": "gouki",
            "controlType": "classic",
            "rank": "マスター",
            "masterRating": 1500,
            "weakAgainst": ["guile"],
            "challenges": ["弾キャラへの立ち回り"],
        },
        "chars": ["gouki", "guile"],
        "question": "ガイル戦のアプローチ方法を教えて。弾がきつい",
    },
    {
        "id": "bm_05",
        "desc": "リュウ: 初心者向け基本コンボ（モダン操作）",
        "profile": {
            "mainCharacter": "ryu",
            "controlType": "modern",
            "rank": "ルーキー",
            "weakAgainst": [],
            "challenges": ["コンボが繋がらない"],
        },
        "chars": ["ryu"],
        "question": "モダン操作でおすすめのコンボを教えて。発生が速い技から始めたい",
    },
]


# --- バリアント定義 ---
# 各バリアントはプロンプト構築の設定差分を表す

class VariantConfig:
    """テストバリアントの設定"""

    def __init__(
        self,
        name: str,
        desc: str,
        use_knowledge: bool = True,
        use_digest: bool = True,
        max_entries: int = 8,
        max_frame_moves: int = 15,
        prompt_style: str = "standard",
    ):
        self.name = name
        self.desc = desc
        # ナレッジ（エントリ）を注入するか
        self.use_knowledge = use_knowledge
        # ダイジェスト（キャラサマリー）を注入するか
        self.use_digest = use_digest
        # 注入するナレッジエントリの最大数
        self.max_entries = max_entries
        # フレームデータの表示技数（上位N技）
        self.max_frame_moves = max_frame_moves
        # プロンプトスタイル: "standard" or "strict"（より厳格なルール付き）
        self.prompt_style = prompt_style


VARIANTS: dict[str, VariantConfig] = {
    "baseline": VariantConfig(
        name="baseline",
        desc="現行設定（ダイジェスト+エントリ8件+フレーム15技）",
        use_knowledge=True,
        use_digest=True,
        max_entries=8,
        max_frame_moves=15,
    ),
    "no_knowledge": VariantConfig(
        name="no_knowledge",
        desc="ナレッジなし（フレームデータのみ）",
        use_knowledge=False,
        use_digest=False,
        max_entries=0,
        max_frame_moves=15,
    ),
    "no_digest": VariantConfig(
        name="no_digest",
        desc="ダイジェストなし（エントリのみ）",
        use_knowledge=True,
        use_digest=False,
        max_entries=8,
        max_frame_moves=15,
    ),
    "more_entries": VariantConfig(
        name="more_entries",
        desc="ナレッジエントリ増加（最大15件）",
        use_knowledge=True,
        use_digest=True,
        max_entries=15,
        max_frame_moves=15,
    ),
    "strict_prompt": VariantConfig(
        name="strict_prompt",
        desc="厳格プロンプト（フレーム引用を義務付け）",
        use_knowledge=True,
        use_digest=True,
        max_entries=8,
        max_frame_moves=15,
        prompt_style="strict",
    ),
}


def build_variant_prompt(
    profile: dict, char_slugs: list, question: str, variant: VariantConfig
) -> str:
    """バリアント設定に基づいてシステムプロンプトを構築する"""

    # フレームデータ
    frame_context = ""
    for slug in char_slugs[:3]:
        fpath = Path(__file__).parent.parent / "data" / "frame_data" / f"{slug}.json"
        if not fpath.exists():
            continue
        data = json.loads(fpath.read_text())
        moves = data if isinstance(data, list) else data.get("moves", [])
        frame_context += f"\n## {slug} フレームデータ（上位{variant.max_frame_moves}技）\n"
        for m in moves[: variant.max_frame_moves]:
            name = m.get("skill", "")
            startup = m.get("startup_frame", "")
            block = m.get("block_frame", "")
            cancel = m.get("web_cancel", "不可")
            frame_context += f"- {name}: 発生{startup}F ガード{block} キャンセル:{cancel}\n"

    # ナレッジコンテキスト
    knowledge_context = ""
    if variant.use_knowledge:
        kdir = Path(__file__).parent.parent / "data" / "knowledge"

        # ダイジェスト（オプション）
        digest_text = ""
        if variant.use_digest:
            ddir = kdir / "_digests"
            for slug in char_slugs:
                dpath = ddir / f"{slug}.md"
                if dpath.exists():
                    # 先頭800文字のみ（トークン節約）
                    digest = dpath.read_text()[:800]
                    digest_text += f"\n### {slug} ナレッジサマリー\n{digest}\n"

        # ナレッジエントリ
        entries: list = []
        for slug in char_slugs:
            kpath = kdir / f"{slug}.json"
            if kpath.exists():
                kdata = json.loads(kpath.read_text())
                entries.extend(kdata.get("entries", []))
        gen_path = kdir / "general.json"
        if gen_path.exists():
            gdata = json.loads(gen_path.read_text())
            entries.extend(gdata.get("entries", []))

        if digest_text or (entries and variant.max_entries > 0):
            knowledge_context = "\n## プロ選手の知識\n"
            if digest_text:
                knowledge_context += digest_text
            if entries and variant.max_entries > 0:
                knowledge_context += f"\n### 関連エントリ（最大{variant.max_entries}件）\n"
                for e in entries[: variant.max_entries]:
                    knowledge_context += (
                        f"- [{e['category']}] {e['topic']}: {e['content'][:120]}\n"
                    )

    # プロフィール
    profile_text = f"メインキャラ: {profile['mainCharacter']}\n操作タイプ: {profile['controlType']}\nランク: {profile['rank']}"
    if profile.get("masterRating"):
        profile_text += f"（MR: {profile['masterRating']}）"
    if profile.get("weakAgainst"):
        profile_text += f"\n苦手: {', '.join(profile['weakAgainst'])}"
    if profile.get("challenges"):
        profile_text += f"\n課題: {', '.join(profile['challenges'])}"

    # プロンプトスタイルによる差分
    if variant.prompt_style == "strict":
        rules = """## 厳格ルール
- 技に言及する場合、必ず発生フレーム・ガード硬直差・キャンセル可否を数値で明示すること
- フレームデータにない技・数値は絶対に述べてはならない
- 「確認が必要」と言う前に、まず下記フレームデータを確認すること"""
    else:
        rules = """## ルール
- フレームデータを優先参照する
- フレームデータにない内容は「確認が必要」と明示する"""

    return f"""あなたはSF6の専属AIコーチです。正確なフレームデータに基づいてアドバイスしてください。

{rules}

## プレイヤー情報
{profile_text}

## フレームデータ
{frame_context}
{knowledge_context}
日本語で簡潔に回答。"""


def generate_response(system_prompt: str, question: str) -> str:
    """コーチ応答を生成する"""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {"role": "user", "parts": [{"text": system_prompt}]},
                {"role": "user", "parts": [{"text": question}]},
            ],
        )
        return response.text
    except Exception as e:
        return f"ERROR: {e}"


# LLMジャッジ用プロンプトテンプレート
EVAL_PROMPT_TEMPLATE = """あなたはSF6（ストリートファイター6）の専門家レビュアーです。
以下のAIコーチの回答を3つの観点から採点してください。

## 評価対象
**質問:** {question}

**プレイヤー情報:** {profile_summary}

**AIコーチの回答:**
{response}

## 正解確認用フレームデータ（一部抜粋）
{frame_data_snippet}

## 採点基準

### 1. 正確性（1-5点）
- 5: フレームデータの数値・キャンセル可否が完全に正確。誤情報なし
- 4: 軽微な省略はあるが誤った数値はない
- 3: 一部不正確な情報が含まれる
- 2: 誤ったフレームデータ引用が複数ある
- 1: フレームデータを全く参照していないか、大きく間違っている

### 2. 実用性（1-5点）
- 5: 実戦で即使える具体的なアドバイス（状況・理由・方法が揃っている）
- 4: 概ね実践的。若干抽象的な部分がある
- 3: 参考になるが汎用的すぎる
- 2: 一般論のみで具体性がない
- 1: アドバイスとして機能しない

### 3. フレーム引用の正しさ（1-5点）
- 5: 技名・発生フレーム・ガード硬直差・キャンセル可否を正確にセットで引用
- 4: ほぼ正確。一部省略がある
- 3: 数値はあるが文脈が不正確
- 2: フレームの概念的な説明のみ（具体的数値なし）
- 1: フレームデータへの言及なし

必ず以下のJSON形式のみで出力すること（他のテキスト不要）:
```json
{{
  "accuracy": <1-5の整数>,
  "practicality": <1-5の整数>,
  "frame_citation": <1-5の整数>,
  "total": <3つの平均、小数点1桁>,
  "comment": "<50字以内の総評>"
}}
```"""


def evaluate_response(
    question: str, profile: dict, response: str, chars: list
) -> dict:
    """LLMを使って応答品質を評価する（LLM-as-a-Judge）"""

    # フレームデータの抜粋（評価者の正解確認用）
    frame_snippet = ""
    for slug in chars[:2]:
        fpath = Path(__file__).parent.parent / "data" / "frame_data" / f"{slug}.json"
        if not fpath.exists():
            continue
        data = json.loads(fpath.read_text())
        moves = data if isinstance(data, list) else data.get("moves", [])
        parts = [
            f"{m.get('skill')}(発生{m.get('startup_frame')}F,ガード{m.get('block_frame')},キャンセル:{m.get('web_cancel','不可')})"
            for m in moves[:10]
        ]
        frame_snippet += f"{slug}: {', '.join(parts)}\n"

    profile_summary = (
        f"メイン:{profile['mainCharacter']} ランク:{profile['rank']} "
        f"課題:{', '.join(profile.get('challenges', []))}"
    )

    eval_prompt = EVAL_PROMPT_TEMPLATE.format(
        question=question,
        profile_summary=profile_summary,
        # 長い応答は切り詰める
        response=response[:1200],
        frame_data_snippet=frame_snippet,
    )

    try:
        eval_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": eval_prompt}]}],
        )
        text = eval_response.text.strip()
        # JSONブロックを抽出
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        return {
            "accuracy": 0,
            "practicality": 0,
            "frame_citation": 0,
            "total": 0.0,
            "comment": f"評価エラー: {e}",
        }


def print_summary_table(results: dict) -> None:
    """バリアント比較サマリーをコンソールに表示する"""
    print("\n" + "=" * 80)
    print("A/Bテスト結果サマリー")
    print("=" * 80)

    # バリアント別の平均スコアを集計
    variant_scores: dict[str, dict[str, list]] = {}
    for _case_id, case_results in results.items():
        for variant_name, data in case_results.items():
            if variant_name not in variant_scores:
                variant_scores[variant_name] = {
                    "accuracy": [],
                    "practicality": [],
                    "frame_citation": [],
                    "total": [],
                }
            ev = data.get("evaluation", {})
            for metric in ["accuracy", "practicality", "frame_citation", "total"]:
                val = ev.get(metric, 0)
                if isinstance(val, (int, float)) and val > 0:
                    variant_scores[variant_name][metric].append(float(val))

    # テーブル表示
    print(f"\n{'バリアント':<22} {'正確性':>6} {'実用性':>6} {'引用':>6} {'総合':>6}  説明")
    print("-" * 80)
    for variant_name, scores in variant_scores.items():
        avg = {k: (sum(v) / len(v) if v else 0.0) for k, v in scores.items()}
        desc = VARIANTS[variant_name].desc if variant_name in VARIANTS else ""
        print(
            f"{variant_name:<22} {avg['accuracy']:>6.2f} {avg['practicality']:>6.2f} "
            f"{avg['frame_citation']:>6.2f} {avg['total']:>6.2f}  {desc}"
        )

    # ケース別詳細
    print("\n\nケース別詳細:")
    print("-" * 80)
    for case_id, case_results in results.items():
        case = next((c for c in BENCHMARK_CASES if c["id"] == case_id), None)
        if not case:
            continue
        print(f"\n[{case_id}] {case['desc']}")
        print(f"  Q: {case['question']}")
        for variant_name, data in case_results.items():
            ev = data.get("evaluation", {})
            comment = ev.get("comment", "-")
            print(
                f"  {variant_name:<20}: 正確性={ev.get('accuracy',0)} "
                f"実用性={ev.get('practicality',0)} 引用={ev.get('frame_citation',0)} "
                f"総合={ev.get('total',0)} | {comment}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="SF6コーチ応答品質A/Bテスト")
    parser.add_argument(
        "--variants",
        default=",".join(VARIANTS.keys()),
        help=(
            f"カンマ区切りのバリアント名 (デフォルト: 全バリアント)。"
            f"選択肢: {','.join(VARIANTS.keys())}"
        ),
    )
    parser.add_argument(
        "--cases",
        nargs="*",
        help="テストするケースID (例: bm_01 bm_02)。省略時は全ケース",
    )
    parser.add_argument(
        "--skip-eval",
        action="store_true",
        help="LLM評価をスキップして応答生成のみ行う（コスト節約用）",
    )
    parser.add_argument(
        "--output",
        default="logs/ab_benchmark_results.json",
        help="結果保存先JSONパス（デフォルト: logs/ab_benchmark_results.json）",
    )
    args = parser.parse_args()

    # バリアント選択
    selected_variants = [
        v.strip() for v in args.variants.split(",") if v.strip() in VARIANTS
    ]
    if not selected_variants:
        print(f"有効なバリアントがありません。選択肢: {','.join(VARIANTS.keys())}")
        sys.exit(1)

    # ケース選択
    selected_cases = [
        c
        for c in BENCHMARK_CASES
        if not args.cases or c["id"] in args.cases
    ]
    if not selected_cases:
        print("有効なケースが見つかりません")
        sys.exit(1)

    # 実行前サマリー
    total_gen = len(selected_variants) * len(selected_cases)
    total_eval = 0 if args.skip_eval else total_gen
    print(f"実行設定:")
    print(f"  バリアント ({len(selected_variants)}件): {selected_variants}")
    print(f"  ケース ({len(selected_cases)}件): {[c['id'] for c in selected_cases]}")
    print(f"  LLM評価: {'スキップ' if args.skip_eval else '実施'}")
    print(f"  総APIリクエスト: 応答生成 {total_gen}回 + 評価 {total_eval}回 = {total_gen + total_eval}回")
    print()

    all_results: dict = {}

    for case in selected_cases:
        case_id = case["id"]
        print(f"\n{'=' * 60}")
        print(f"ケース [{case_id}]: {case['desc']}")
        print(f"質問: {case['question']}")
        print("=" * 60)

        all_results[case_id] = {}

        for variant_name in selected_variants:
            variant = VARIANTS[variant_name]
            print(f"\n  [{variant_name}] {variant.desc}")

            # 応答生成
            system_prompt = build_variant_prompt(
                case["profile"], case["chars"], case["question"], variant
            )
            response = generate_response(system_prompt, case["question"])
            preview = response[:250] + ("..." if len(response) > 250 else "")
            print(f"  応答 ({len(response)}文字): {preview}")

            # LLM評価
            evaluation: dict = {}
            if not args.skip_eval:
                # レートリミット対策
                time.sleep(2)
                print("  評価中...")
                evaluation = evaluate_response(
                    case["question"], case["profile"], response, case["chars"]
                )
                ev = evaluation
                print(
                    f"  スコア: 正確性={ev.get('accuracy', 0)} "
                    f"実用性={ev.get('practicality', 0)} "
                    f"引用={ev.get('frame_citation', 0)} "
                    f"総合={ev.get('total', 0)}"
                )
                print(f"  コメント: {ev.get('comment', '')}")

            all_results[case_id][variant_name] = {
                "variant": variant_name,
                "variant_desc": variant.desc,
                "question": case["question"],
                "response": response,
                "response_length": len(response),
                "evaluation": evaluation,
            }

            # レートリミット対策
            time.sleep(1)

    # サマリー表示
    if not args.skip_eval:
        print_summary_table(all_results)

    # 結果をJSONに保存
    out_path = Path(__file__).parent / args.output
    out_path.parent.mkdir(exist_ok=True)

    output_data = {
        "timestamp": datetime.datetime.now().isoformat(),
        "variants_tested": selected_variants,
        "cases_tested": [c["id"] for c in selected_cases],
        "results": all_results,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"\n結果を保存: {out_path}")


if __name__ == "__main__":
    main()
