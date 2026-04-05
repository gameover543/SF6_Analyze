#!/bin/bash
# AI回答品質テスト: ペルソナ別 + 全キャラ精度チェック
# 使い方: bash scripts/test_ai_quality.sh
set -euo pipefail

BASE_URL="http://localhost:3000"
OUTDIR="scripts/test_results"
mkdir -p "$OUTDIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$OUTDIR/quality_test_${TIMESTAMP}.md"

echo "# AI回答品質テスト — $(date '+%Y-%m-%d %H:%M')" > "$RESULT_FILE"

# SSEストリーミング応答を読み取って結合する関数
read_sse() {
  local response="$1"
  echo "$response" | grep '^data: ' | sed 's/^data: //' | grep -v '^\[DONE\]' | while read -r line; do
    echo "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('chunk',''),end='')" 2>/dev/null
  done
}

# APIにクイックアドバイスを送る関数
ask() {
  local question="$1"
  local main_char="$2"
  local control_type="$3"
  local rank="$4"

  local response
  response=$(curl -s -N "$BASE_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"messages\": [{\"role\": \"user\", \"content\": \"$question\"}],
      \"profile\": {\"mainCharacter\": \"$main_char\", \"controlType\": \"$control_type\", \"rank\": \"$rank\"},
      \"mode\": \"quick\"
    }" 2>/dev/null || echo "ERROR")

  read_sse "$response"
}

echo ""
echo "=== ペルソナ別テスト開始 ==="

# --- ペルソナ1: マスター帯ジェイミー/クラシック ---
echo "" >> "$RESULT_FILE"
echo "## ペルソナ1: マスター帯 ジェイミー/CL" >> "$RESULT_FILE"

questions_p1=(
  "テリーのバーンナックル確反ある？"
  "ケンの迅雷ガードしたらどうする？"
  "ガイル戦の立ち回り教えて"
  "大ゴス確反ある？"
  "JPの弾対策どうすればいい？"
  "酔疾歩で弾抜けできる？"
  "起き攻めで投げと打撃のバランスどうしてる？"
  "ラシード戦で困ってるんだけど"
  "ドライブゲージ不利な時の立ち回りは？"
  "画面端の崩しパターン教えて"
)

for q in "${questions_p1[@]}"; do
  echo "  P1: $q"
  answer=$(ask "$q" "jamie" "classic" "マスター")
  echo "" >> "$RESULT_FILE"
  echo "### Q: $q" >> "$RESULT_FILE"
  echo "$answer" >> "$RESULT_FILE"
  sleep 1
done

# --- ペルソナ2: ゴールド帯リュウ/モダン ---
echo "" >> "$RESULT_FILE"
echo "## ペルソナ2: ゴールド帯 リュウ/MO" >> "$RESULT_FILE"

questions_p2=(
  "対空が全然できないんだけど"
  "コンボが安定しない"
  "波動拳の使い方教えて"
  "ドライブインパクト返せない"
  "確反って何？"
  "起き攻めされると何もできない"
  "ラッシュからの攻めがわからない"
  "ザンギエフの投げがきつい"
  "大足のあとどうすればいい？"
  "SAゲージいつ使えばいい？"
)

for q in "${questions_p2[@]}"; do
  echo "  P2: $q"
  answer=$(ask "$q" "ryu" "modern" "ゴールド")
  echo "" >> "$RESULT_FILE"
  echo "### Q: $q" >> "$RESULT_FILE"
  echo "$answer" >> "$RESULT_FILE"
  sleep 1
done

# --- ペルソナ3: マスター帯ケン/クラシック ---
echo "" >> "$RESULT_FILE"
echo "## ペルソナ3: マスター帯 ケン/CL" >> "$RESULT_FILE"

questions_p3=(
  "迅雷の使い分け教えて"
  "ジェイミー戦きついんだけど"
  "画面端の起き攻めどうしてる？"
  "中足ラッシュ以外の崩しある？"
  "龍尾ガードされた後どうする？"
  "弾を撃つタイミングがわからん"
  "奮迅って実戦で使える？"
  "対空昇竜がよく落とされる"
  "バーンアウトした時の切り返しは？"
  "豪鬼戦の立ち回り"
)

for q in "${questions_p3[@]}"; do
  echo "  P3: $q"
  answer=$(ask "$q" "ken" "classic" "マスター")
  echo "" >> "$RESULT_FILE"
  echo "### Q: $q" >> "$RESULT_FILE"
  echo "$answer" >> "$RESULT_FILE"
  sleep 1
done

# --- ペルソナ4: シルバー帯キャミィ/モダン ---
echo "" >> "$RESULT_FILE"
echo "## ペルソナ4: シルバー帯 キャミィ/MO" >> "$RESULT_FILE"

questions_p4=(
  "キャノンスパイクいつ使うの？"
  "ストライクの使い方教えて"
  "立ち回りで何をすればいい？"
  "フーリガンって使える？"
  "投げが多い相手にどうすればいい？"
  "モダンだと弱い技ある？"
  "アシストコンボだけでいい？"
  "ドライブラッシュの使い方"
  "本田戦どうすればいい？"
  "画面端に追い込まれたら"
)

for q in "${questions_p4[@]}"; do
  echo "  P4: $q"
  answer=$(ask "$q" "cammy" "modern" "シルバー")
  echo "" >> "$RESULT_FILE"
  echo "### Q: $q" >> "$RESULT_FILE"
  echo "$answer" >> "$RESULT_FILE"
  sleep 1
done

# --- ペルソナ5: マスター帯 豪鬼/クラシック ---
echo "" >> "$RESULT_FILE"
echo "## ペルソナ5: マスター帯 豪鬼/CL" >> "$RESULT_FILE"

questions_p5=(
  "斬空の高度使い分けどうしてる？"
  "百鬼からの択の配分は？"
  "瞬獄殺いつ狙う？"
  "灼熱と通常波動の使い分け"
  "体力低いから守り重要だけどコツは？"
  "赤星の使いどころ"
  "春麗戦の立ち回り教えて"
  "阿修羅の使い方が下手なんだけど"
  "端の起き攻めで最大リターン取りたい"
  "弾対策された時どうする？"
)

for q in "${questions_p5[@]}"; do
  echo "  P5: $q"
  answer=$(ask "$q" "gouki" "classic" "マスター")
  echo "" >> "$RESULT_FILE"
  echo "### Q: $q" >> "$RESULT_FILE"
  echo "$answer" >> "$RESULT_FILE"
  sleep 1
done

echo ""
echo "=== ペルソナテスト完了（50問） ==="
echo ""

# --- 全キャラ精度チェック ---
echo "=== 全キャラ精度チェック開始 ==="
echo "" >> "$RESULT_FILE"
echo "## 全キャラ精度チェック（29キャラ × 2操作タイプ）" >> "$RESULT_FILE"

chars=("ryu" "luke" "jamie" "chunli" "guile" "kimberly" "juri" "ken" "blanka" "dhalsim" "ehonda" "deejay" "manon" "marisa" "jp" "zangief" "lily" "cammy" "rashid" "aki" "ed" "gouki" "mbison" "terry" "mai" "elena" "cviper" "sagat" "alex")

for char in "${chars[@]}"; do
  for ct in "classic" "modern"; do
    label="${ct:0:2}"
    echo "  ${char}/${label}: テスト中..."
    # 各キャラに対して、そのキャラの特徴を聞く質問
    answer=$(ask "このキャラの強みと基本戦術を短く教えて" "$char" "$ct" "ダイヤ")
    echo "" >> "$RESULT_FILE"
    echo "### ${char} (${ct})" >> "$RESULT_FILE"
    echo "$answer" >> "$RESULT_FILE"
    sleep 1
  done
done

echo ""
echo "=== 全テスト完了 ==="
echo "結果: $RESULT_FILE"
