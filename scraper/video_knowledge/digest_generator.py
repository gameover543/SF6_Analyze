"""キャラ別ダイジェスト生成: ナレッジをLLMで要約してコア知識を作る

全キャラのナレッジエントリを要約し、プロンプトに常時含める
「このキャラの核心」を凝縮したテキストを生成する。

生成物:
  data/knowledge/_digests/{slug}.md  — キャラ別のコア知識要約（約1500-2000文字）
"""

import json
import logging
import os
import time
from pathlib import Path

from dotenv import load_dotenv

from .config import PipelineConfig, CHARACTER_JP_NAMES
from .sources import DataStore

load_dotenv(Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger(__name__)

DIGEST_PROMPT = """あなたはSF6（ストリートファイター6）の攻略エキスパートです。
以下は{char_name}（{slug}）に関するプロ選手の知識データ（{entry_count}件）です。

これらを分析し、{char_name}を使う上で**最も重要なコア知識**を以下の形式で要約してください。

## 出力形式（マークダウン）

### キャラクター特性
- このキャラの強み・弱みを2-3行で

### 主要技と使い方
- 立ち回りの主力技（3-5つ）とその使い方

### 基本戦略
- 立ち回りの基本方針（近距離/中距離/遠距離）
- ドライブゲージの使い方

### 起き攻め・セットプレイ
- 主要な起き攻めパターン（2-3つ）

### 防御・切り返し
- 守りの基本方針、暴れ技、切り返し手段

### 注意すべきマッチアップ
- 苦手キャラとその理由（上位2-3キャラ）

## ルール
- 1500-2000文字程度に収める
- 具体的なフレーム数値は含めない（パッチで変わるため）
- 「〇〇が強い」「〇〇を意識する」のように実戦で使える形で書く
- 初心者〜中級者が読んで理解できる表現にする
- ソース（チャンネル名等）は書かない

## ナレッジデータ
{entries_text}
"""


def generate_digests(
    config: PipelineConfig | None = None,
    target_slugs: list[str] | None = None,
) -> dict[str, str]:
    """全キャラ（or指定キャラ）のダイジェストを生成"""
    if config is None:
        config = PipelineConfig()

    store = DataStore(config)
    digests_dir = config.knowledge_dir / "_digests"
    digests_dir.mkdir(parents=True, exist_ok=True)

    # Gemini クライアント初期化
    from google import genai
    if config.use_vertex_ai:
        client = genai.Client(
            vertexai=True,
            project=config.vertex_project,
            location=config.vertex_location,
        )
    else:
        client = genai.Client(api_key=config.google_api_key)

    slugs = target_slugs or list(CHARACTER_JP_NAMES.keys())
    results = {}

    for slug in slugs:
        char_jp = CHARACTER_JP_NAMES.get(slug, slug)
        knowledge = store.load_character_knowledge(slug)

        if not knowledge.entries:
            logger.info(f"  {slug}: ナレッジなし、スキップ")
            continue

        # エントリをテキスト化（トークン節約: 上位50件、各100文字まで）
        entries_sorted = sorted(
            knowledge.entries,
            key=lambda e: e.confidence * e.channel_trust,
            reverse=True,
        )[:50]

        entries_lines = []
        for e in entries_sorted:
            entries_lines.append(
                f"[{e.category}] {e.topic}: {e.content[:150]}"
            )
        entries_text = "\n".join(entries_lines)

        prompt = DIGEST_PROMPT.format(
            char_name=char_jp,
            slug=slug,
            entry_count=len(knowledge.entries),
            entries_text=entries_text,
        )

        logger.info(f"  {slug} ({char_jp}): {len(knowledge.entries)}件 → ダイジェスト生成中...")

        try:
            response = client.models.generate_content(
                model=config.gemini_model,
                contents=prompt,
            )
            digest = response.text

            # 保存
            digest_path = digests_dir / f"{slug}.md"
            digest_path.write_text(digest, encoding="utf-8")
            results[slug] = digest
            logger.info(f"  {slug}: {len(digest)}文字のダイジェスト生成完了")

            time.sleep(3)  # レートリミット

        except Exception as e:
            logger.error(f"  {slug}: ダイジェスト生成失敗: {e}")
            time.sleep(10)

    # マニフェスト更新
    manifest_path = digests_dir / "_manifest.json"
    manifest = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "digests": {
            slug: {
                "file": f"{slug}.md",
                "chars": len(store.load_character_knowledge(slug).entries),
            }
            for slug in results
        },
        "total": len(results),
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

    logger.info(f"ダイジェスト生成完了: {len(results)}キャラ")
    return results


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    parser = argparse.ArgumentParser(description="キャラ別ダイジェスト生成")
    parser.add_argument("--characters", nargs="*", help="対象キャラslug（省略時は全キャラ）")
    args = parser.parse_args()

    results = generate_digests(target_slugs=args.characters)
    print(f"\n生成完了: {len(results)}キャラ")
    for slug, digest in results.items():
        print(f"  {slug}: {len(digest)}文字")
