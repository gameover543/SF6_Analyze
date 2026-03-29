"""既存ナレッジのマイグレーション: 新フィールドをバックフィル

- game_version: 現在のフレームデータバージョンを設定
- video_upload_date: _index.jsonから取得（可能な場合）
- referenced_moves: move_resolverで自動解決
- staleness_status: "current"（初回は全てcurrent）
- last_validated_version: 現在のバージョン
"""

import json
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "scraper"))

from video_knowledge.move_resolver import MoveResolver
from video_knowledge.config import CHARACTER_JP_NAMES

KNOWLEDGE_DIR = project_root / "data" / "knowledge"
FRAME_DATA_DIR = project_root / "data" / "frame_data"


def main():
    resolver = MoveResolver(FRAME_DATA_DIR)
    game_version = resolver.get_game_version()
    print(f"現在のゲームバージョン: {game_version}")

    total_entries = 0
    total_resolved = 0

    for slug in list(CHARACTER_JP_NAMES.keys()) + ["general"]:
        path = KNOWLEDGE_DIR / f"{slug}.json"
        if not path.exists():
            continue

        data = json.loads(path.read_text(encoding="utf-8"))
        entries = data.get("entries", [])
        if not entries:
            continue

        modified = False
        for entry in entries:
            total_entries += 1

            # game_version
            if not entry.get("game_version"):
                entry["game_version"] = game_version
                modified = True

            # staleness_status
            if "staleness_status" not in entry:
                entry["staleness_status"] = "current"
                modified = True

            # staleness_reason
            if "staleness_reason" not in entry:
                entry["staleness_reason"] = ""
                modified = True

            # last_validated_version
            if not entry.get("last_validated_version"):
                entry["last_validated_version"] = game_version
                modified = True

            # video_upload_date
            if "video_upload_date" not in entry:
                entry["video_upload_date"] = ""
                modified = True

            # referenced_moves: テキストから技名解決
            if not entry.get("referenced_moves"):
                chars = entry.get("characters", [])
                content = entry.get("content", "")
                quote = entry.get("source_quote", "")
                moves = resolver.resolve_for_entry(content, quote, chars)
                entry["referenced_moves"] = moves
                if moves:
                    total_resolved += 1
                modified = True

        if modified:
            # last_validated_version をキャラレベルでも設定
            data["last_validated_version"] = game_version

            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            move_count = sum(
                len(e.get("referenced_moves", []))
                for e in entries
            )
            print(f"  {slug}: {len(entries)}件更新, {move_count}技参照を解決")

    print(f"\n完了: {total_entries}件処理, {total_resolved}件で技参照を解決")


if __name__ == "__main__":
    main()
