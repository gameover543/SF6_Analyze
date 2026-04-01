#!/bin/bash
# ============================================================
# SF6 タスク自動実行ループ
#
# tasks.jsonのpendingタスクを優先度順に1つずつ実行する。
# 各タスクは独立したclaude CLIセッション（コンテキストリセット）で実行。
# Agent.mdを介してセッション間の知見を引き継ぐ。
#
# 使い方:
#   bash scripts/task_runner.sh              # 全pendingタスクを順次実行
#   bash scripts/task_runner.sh --max 3      # 最大3タスクまで実行
#   bash scripts/task_runner.sh --task-id 1  # 特定タスクのみ実行
#   bash scripts/task_runner.sh --dry-run    # 実行せずプロンプトを表示
# ============================================================

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_FILE="$PROJECT_DIR/tasks.json"
AGENT_FILE="$PROJECT_DIR/Agent.md"
TEMPLATE_FILE="$PROJECT_DIR/scripts/task_prompt_template.md"
LOG_DIR="$PROJECT_DIR/scripts/logs"

# ログディレクトリ作成
mkdir -p "$LOG_DIR"

# --- 引数パース ---
MAX_TASKS=999
TARGET_TASK_ID=""
DRY_RUN=false
MODEL="opus"

while [[ $# -gt 0 ]]; do
  case $1 in
    --max) MAX_TASKS="$2"; shift 2 ;;
    --task-id) TARGET_TASK_ID="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --model) MODEL="$2"; shift 2 ;;
    *) echo "不明なオプション: $1"; exit 1 ;;
  esac
done

# --- ユーティリティ ---

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $1"
}

# tasks.jsonからpendingタスクをpriority順で取得（jqを使用）
get_pending_tasks() {
  if [[ -n "$TARGET_TASK_ID" ]]; then
    # 特定タスク指定
    jq -r --arg id "$TARGET_TASK_ID" \
      '.tasks[] | select(.id == ($id | tonumber) and .status == "pending") | "\(.id)|\(.priority)|\(.subject)|\(.description)"' \
      "$TASKS_FILE"
  else
    # priority順: high → medium → low
    jq -r '
      .tasks[]
      | select(.status == "pending")
      | "\(.id)|\(.priority)|\(.subject)|\(.description)"
    ' "$TASKS_FILE" | \
    awk -F'|' '
      {
        prio = 3
        if ($2 == "high") prio = 1
        else if ($2 == "medium") prio = 2
        print prio "|" $0
      }
    ' | sort -t'|' -k1,1n | cut -d'|' -f2-
  fi
}

# タスク用プロンプトを生成
build_prompt() {
  local task_id="$1"
  local task_subject="$2"
  local task_description="$3"
  local task_priority="$4"

  cat <<PROMPT_EOF
# タスク実行指示

## 対象タスク
- ID: ${task_id}
- 件名: ${task_subject}
- 優先度: ${task_priority}
- 内容: ${task_description}

## 実行手順（必ずこの順序で）

### Step 1: Agent.mdを読む
\`/Users/yasuwo/Project/SF6/Agent.md\` を読み、前タスクからの申し送り・注意点を確認する。

### Step 2: 関連コードを調査
タスクに関連するファイルを読んで現状を把握する。変更前に必ず理解すること。

### Step 3: 実装
タスクの内容を実装する。以下を守ること:
- TypeScriptの型エラーを出さない
- 既存機能を壊さない
- コメントは日本語
- 不要なファイルを作らない
- 過剰な抽象化をしない

### Step 4: ビルド確認
\`cd /Users/yasuwo/Project/SF6/app && npx next build\` を実行してエラーがないことを確認する。
エラーが出たら修正してから再度ビルドする。

### Step 5: tasks.jsonを更新
\`/Users/yasuwo/Project/SF6/tasks.json\` のタスクID ${task_id} のstatusを "done" に変更する。

### Step 6: Agent.mdを更新
\`/Users/yasuwo/Project/SF6/Agent.md\` の以下のセクションを更新する:
- **完了タスクの記録**: タスクID ${task_id}「${task_subject}」の実施内容を簡潔に記録
- **累積した知見・注意点**: このタスクで学んだコードベースの知見を追記
- **次のタスクへの申し送り**: 次のタスクに影響しうる情報を記載

### Step 7: gitコミット
全変更をgitでコミットする。コミットメッセージは日本語で:
\`タスク#${task_id}: ${task_subject}\`

PROMPT_EOF
}

# --- メインループ ---

log "=== SF6 タスク自動実行ループ開始 ==="
log "プロジェクト: $PROJECT_DIR"
log "モデル: $MODEL"
log "最大タスク数: $MAX_TASKS"

# pendingタスクを取得
PENDING=$(get_pending_tasks)

if [[ -z "$PENDING" ]]; then
  log "実行するpendingタスクがありません。"
  exit 0
fi

TASK_COUNT=$(echo "$PENDING" | wc -l | tr -d ' ')
log "pendingタスク数: $TASK_COUNT"

COMPLETED=0
FAILED=0
TASK_NUM=0

# パイプではなくプロセス置換を使い、変数をメインシェルで保持する
while IFS='|' read -r task_id task_priority task_subject task_description; do
  TASK_NUM=$((TASK_NUM + 1))

  if [[ $TASK_NUM -gt $MAX_TASKS ]]; then
    log "最大タスク数 ($MAX_TASKS) に達しました。停止します。"
    break
  fi

  log "-------------------------------------------"
  log "タスク $TASK_NUM/$TASK_COUNT: #${task_id} [${task_priority}] ${task_subject}"
  log "-------------------------------------------"

  # プロンプト生成
  PROMPT=$(build_prompt "$task_id" "$task_subject" "$task_description" "$task_priority")

  if $DRY_RUN; then
    log "[DRY RUN] 以下のプロンプトを送信予定:"
    echo "$PROMPT"
    echo ""
    continue
  fi

  # ログファイル
  LOG_FILE="$LOG_DIR/task_${task_id}_$(date +%Y%m%d_%H%M%S).log"

  log "claude CLI実行開始... (ログ: $LOG_FILE)"

  # claude CLIを非対話モードで実行
  # --print: 非対話モード
  # --model: モデル指定
  # --dangerously-skip-permissions: 書き込み・bash実行を自動承認（ローカル開発環境用）
  # --max-budget-usd: コスト上限
  # stdinをリダイレクトして、whileループのFDを奪わないようにする
  EXIT_CODE=0
  claude -p \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --max-budget-usd 5 \
    "$PROMPT" \
    < /dev/null 2>&1 | tee "$LOG_FILE" || EXIT_CODE=$?

  if [[ $EXIT_CODE -eq 0 ]]; then
    log "タスク #${task_id} 完了 (exit: $EXIT_CODE)"
    COMPLETED=$((COMPLETED + 1))
  else
    log "タスク #${task_id} 失敗 (exit: $EXIT_CODE)"
    FAILED=$((FAILED + 1))

    # 失敗をAgent.mdに記録
    {
      echo ""
      echo "### タスク#${task_id} 失敗 ($(timestamp))"
      echo "- exit code: $EXIT_CODE"
      echo "- ログ: $LOG_FILE"
      echo "- 次回リトライ時の参考にすること"
    } >> "$AGENT_FILE"
  fi

  log "進捗: 完了=$COMPLETED 失敗=$FAILED 残り=$((TASK_COUNT - TASK_NUM))"
  echo ""
done < <(echo "$PENDING")

log "=== ループ終了 ==="
log "結果: 完了=$COMPLETED 失敗=$FAILED"
