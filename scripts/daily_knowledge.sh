#!/bin/bash
# 毎日自動実行: プロ解説動画からナレッジを収集
#
# 動作:
#   1. 全キャラ対象で動画を自動発見・信頼性評価・知識抽出
#   2. 2時間分の予算で処理（約5-10本の動画）
#   3. 抽出結果を data/knowledge/ に保存
#   4. ログを scraper/logs/ に出力
#
# 手動実行: bash scripts/daily_knowledge.sh
# 停止: Ctrl+C または kill で安全に停止（進捗保存される）

set -euo pipefail

PROJECT_DIR="/Users/yasuwo/Project/SF6"
VENV_PYTHON="${PROJECT_DIR}/.venv/bin/python3"
LOG_DIR="${PROJECT_DIR}/scraper/logs"
LOG_FILE="${LOG_DIR}/knowledge_$(date +%Y%m%d_%H%M%S).log"

# ログディレクトリ作成
mkdir -p "${LOG_DIR}"

echo "$(date '+%Y-%m-%d %H:%M:%S') ナレッジ収集パイプライン開始" | tee "${LOG_FILE}"

# パイプライン実行（2時間分の予算）
cd "${PROJECT_DIR}/scraper"
"${VENV_PYTHON}" -m video_knowledge.main \
  --budget-minutes 120 \
  2>&1 | tee -a "${LOG_FILE}"

echo "$(date '+%Y-%m-%d %H:%M:%S') ナレッジ収集パイプライン完了" | tee -a "${LOG_FILE}"

# 古いログを削除（30日以上前）
find "${LOG_DIR}" -name "knowledge_*.log" -mtime +30 -delete 2>/dev/null || true
