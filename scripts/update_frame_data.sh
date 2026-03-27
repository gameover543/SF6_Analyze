#!/bin/bash
# SF6フレームデータ更新スクリプト
# 使い方:
#   全キャラ更新:    ./scripts/update_frame_data.sh
#   特定キャラのみ:  ./scripts/update_frame_data.sh jamie ryu
#
# 事前準備: CAPCOM IDでログインが必要（初回はブラウザが開きます）

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# venv有効化
source .venv/bin/activate

# scraper実行
if [ $# -eq 0 ]; then
    echo "=== 全キャラクターのフレームデータを更新します ==="
    python scraper/main.py --force
else
    echo "=== 指定キャラクターのフレームデータを更新します: $@ ==="
    python scraper/main.py --force --targets "$@"
fi

echo ""
echo "=== 更新完了 ==="
echo "更新されたファイル:"
git diff --name-only data/frame_data/ 2>/dev/null || echo "(git管理外の変更)"
echo ""
echo "確認後、以下でコミットしてください:"
echo "  git add data/ && git commit -m 'フレームデータ更新: YYYY/MM/DDパッチ対応'"
