#!/bin/bash
# AI回答品質テスト: ローカルサーバー経由（実際のプロンプト+ナレッジ注入で検証）
set -euo pipefail

BASE_URL="http://localhost:3000"
OUTDIR="scripts/test_results"
mkdir -p "$OUTDIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$OUTDIR/quality_local_${TIMESTAMP}.md"

echo "# AI回答品質テスト（実環境） — $(date '+%Y-%m-%d %H:%M')" > "$RESULT_FILE"

# SSE応答を結合する
ask() {
  local question="$1"
  local main_char="$2"
  local control_type="$3"
  local rank="$4"

  local raw
  raw=$(curl -s -N "$BASE_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"messages\": [{\"role\": \"user\", \"content\": $(echo "$question" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')}],
      \"profile\": {\"mainCharacter\": \"$main_char\", \"controlType\": \"$control_type\", \"rank\": \"$rank\"},
      \"mode\": \"quick\"
    }" 2>/dev/null || echo "")

  echo "$raw" | grep '^data: ' | sed 's/^data: //' | grep -v '^\[DONE\]' | while read -r line; do
    echo "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read().strip()); print(d.get('chunk',''),end='')" 2>/dev/null
  done
  # json:advice_meta を除去
}

log() {
  echo "$1" >> "$RESULT_FILE"
}

# ===== ペルソナ1: マスター帯 ジェイミー/CL =====
log ""
log "## ペルソナ1: マスター帯 ジェイミー/CL"
P1_Q=("テリーのバーンナックル確反ある？" "ケンの迅雷ガードしたらどうする？" "ガイル戦の立ち回り教えて" "大ゴス確反ある？" "JPの弾対策どうすればいい？" "酔疾歩で弾抜けできる？" "起き攻めで投げと打撃のバランスどうしてる？" "ラシード戦で困ってるんだけど" "ドライブゲージ不利な時の立ち回りは？" "画面端の崩しパターン教えて")
i=0
for q in "${P1_Q[@]}"; do
  i=$((i+1)); echo "[$i/50] P1: $q"
  ans=$(ask "$q" "jamie" "classic" "マスター")
  log ""; log "### Q: $q"; log "$ans"; log ""
  sleep 3
done

# ===== ペルソナ2: ゴールド帯 リュウ/MO =====
log "## ペルソナ2: ゴールド帯 リュウ/MO"
P2_Q=("対空が全然できないんだけど" "コンボが安定しない" "波動拳の使い方教えて" "ドライブインパクト返せない" "確反って何？" "起き攻めされると何もできない" "ラッシュからの攻めがわからない" "ザンギエフの投げがきつい" "大足のあとどうすればいい？" "SAゲージいつ使えばいい？")
for q in "${P2_Q[@]}"; do
  i=$((i+1)); echo "[$i/50] P2: $q"
  ans=$(ask "$q" "ryu" "modern" "ゴールド")
  log ""; log "### Q: $q"; log "$ans"; log ""
  sleep 3
done

# ===== ペルソナ3: マスター帯 ケン/CL =====
log "## ペルソナ3: マスター帯 ケン/CL"
P3_Q=("迅雷の使い分け教えて" "ジェイミー戦きついんだけど" "画面端の起き攻めどうしてる？" "中足ラッシュ以外の崩しある？" "龍尾ガードされた後どうする？" "弾を撃つタイミングがわからん" "奮迅って実戦で使える？" "対空昇竜がよく落とされる" "バーンアウトした時の切り返しは？" "豪鬼戦の立ち回り")
for q in "${P3_Q[@]}"; do
  i=$((i+1)); echo "[$i/50] P3: $q"
  ans=$(ask "$q" "ken" "classic" "マスター")
  log ""; log "### Q: $q"; log "$ans"; log ""
  sleep 3
done

# ===== ペルソナ4: シルバー帯 キャミィ/MO =====
log "## ペルソナ4: シルバー帯 キャミィ/MO"
P4_Q=("キャノンスパイクいつ使うの？" "ストライクの使い方教えて" "立ち回りで何をすればいい？" "フーリガンって使える？" "投げが多い相手にどうすればいい？" "モダンだと弱い技ある？" "アシストコンボだけでいい？" "ドライブラッシュの使い方" "本田戦どうすればいい？" "画面端に追い込まれたら")
for q in "${P4_Q[@]}"; do
  i=$((i+1)); echo "[$i/50] P4: $q"
  ans=$(ask "$q" "cammy" "modern" "シルバー")
  log ""; log "### Q: $q"; log "$ans"; log ""
  sleep 3
done

# ===== ペルソナ5: マスター帯 豪鬼/CL =====
log "## ペルソナ5: マスター帯 豪鬼/CL"
P5_Q=("斬空の高度使い分けどうしてる？" "百鬼からの択の配分は？" "瞬獄殺いつ狙う？" "灼熱と通常波動の使い分け" "体力低いから守り重要だけどコツは？" "赤星の使いどころ" "春麗戦の立ち回り教えて" "阿修羅の使い方が下手なんだけど" "端の起き攻めで最大リターン取りたい" "弾対策された時どうする？")
for q in "${P5_Q[@]}"; do
  i=$((i+1)); echo "[$i/50] P5: $q"
  ans=$(ask "$q" "gouki" "classic" "マスター")
  log ""; log "### Q: $q"; log "$ans"; log ""
  sleep 3
done

echo ""; echo "=== ペルソナテスト完了（50問） ==="

# ===== 全キャラ精度チェック =====
log ""; log "## 全キャラ精度チェック（29キャラ × 2操作タイプ）"
CHARS=("ryu" "luke" "jamie" "chunli" "guile" "kimberly" "juri" "ken" "blanka" "dhalsim" "ehonda" "deejay" "manon" "marisa" "jp" "zangief" "lily" "cammy" "rashid" "aki" "ed" "gouki" "mbison" "terry" "mai" "elena" "cviper" "sagat" "alex")
j=0
for char in "${CHARS[@]}"; do
  for ct in "classic" "modern"; do
    j=$((j+1)); echo "[$j/58] ${char}/${ct:0:2}"
    ans=$(ask "このキャラの強みと基本戦術を短く教えて" "$char" "$ct" "ダイヤ")
    log ""; log "### ${char} (${ct})"; log "$ans"; log ""
    sleep 3
  done
done

echo ""; echo "=== 全テスト完了: ペルソナ50問 + キャラ58パターン ==="
echo "結果: $RESULT_FILE"
