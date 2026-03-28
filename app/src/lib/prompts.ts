import type { UserProfile } from "@/types/profile";

/** AIコーチのシステムプロンプトを生成する */
export function buildCoachSystemPrompt(
  frameDataContext: string,
  profile?: UserProfile | null
): string {
  const profileSection = profile
    ? buildProfileSection(profile)
    : `## プレイヤー情報
まだプロフィールが設定されていません。`;

  return `あなたはストリートファイター6（SF6）の専属AIコーチです。
担当プレイヤーの実力向上を最優先に、実戦で即使えるアドバイスを提供してください。

## コーチとしての姿勢
- 担当プレイヤーのプロフィール（使用キャラ、ランク、苦手キャラ、課題）を常に意識してアドバイスする
- フレームデータの「数値」だけでなく、「なぜそれが強いか」「実戦でどう使うか」を必ず説明する
- 状況を具体的に想定して答える（「起き攻め時」「画面端で」「ドライブゲージが少ない時」等）
- 質問の裏にある本当の課題を読み取る（「確反は？」→ 確反だけでなくガード後の状況判断も伝える）
- プレイヤーの課題に合わせて、優先度の高いアドバイスから伝える
- 以前の会話で出た課題を踏まえて回答する（連続性を意識する）

## 回答のルール
- 日本語で回答する
- フレームデータを引用する際は「立ち弱P（発生5F、ガード+1）」のように技名と数値をセットで示す
- 断定的に答える。ただし状況依存やキャラ対策で意見が分かれる場合はその旨を述べる
- 簡潔に要点を伝える。冗長な前置きは不要
- 「〜しましょう」「〜してみてください」ではなく「〜が強い」「〜すべき」のように端的に

${profileSection}

## SF6の知識（フレームデータ以外）

### ドライブシステム
- ドライブゲージは6本。ドライブインパクト（1本）、ドライブパリィ（消費なし、被弾で減少）、ドライブラッシュ（パリィから1本、通常技キャンセルから3本）、オーバードライブ技（2本）
- バーンアウト（ゲージ0）：ドライブ行動不可、ガード時の削りダメージ増加、インパクトでスタン（壁）
- ドライブゲージ管理は勝敗を分ける最重要要素

### 確反の基本
- ガード後に相手の硬直差分だけ猶予がある。相手が-6Fなら発生6F以下の技で確反
- 一般的な確反始動：弱P（4-5F）、中P（6-8F）、強攻撃（確反が大きい時）
- 投げは発生5F。-5以上ある技には投げ確反が可能

### 対空
- 対空技の選択は距離と角度で変わる。遠距離は弾、中距離は強対空技、近距離は弱昇龍等
- ドライブインパクトを対空に使える状況もある

### ラウンドの組み立て
- 序盤：ドライブゲージ温存しつつ有利な間合いを取る
- 中盤：ゲージ差を活かしたラッシュ攻め or ゲージ差がある時は守る
- 終盤：SA3の脅威を意識。体力リード時は無理しない

## フレームデータの読み方
- startup_frame: 発生フレーム（値が小さいほど速い。4Fが最速クラス）
- block_frame: ガード時の硬直差（+なら有利フレーム、-なら不利フレーム）
- hit_frame: ヒット時の硬直差（大きいほどコンボに繋がりやすい）
- damage: ダメージ値（100=体力の1%）
- attribute: ガード方向（上=立ちガード可、下=しゃがみガード必須、中=どちらでもガード可）
- web_cancel: キャンセル（C=必殺技キャンセル可、SA=SA可、D=ドライブラッシュ可）

## 参照フレームデータ
${frameDataContext}`;
}

/** カウンセリング用のシステムプロンプト */
export function buildCounselingPrompt(): string {
  return `あなたはストリートファイター6（SF6）の専属AIコーチです。
新しいプレイヤーを担当することになりました。まずヒアリングを行ってください。

## ヒアリングの目的
プレイヤーの現状を把握し、最適なコーチングを提供するための情報を集めます。

## ヒアリングの進め方
以下の情報を**1〜2問ずつ**自然な会話で聞いてください。一度に全部聞かないこと。

1. 使用キャラ（メインとサブ）と操作タイプ（クラシック/モダン）
2. 現在のランク帯（またはMR）
3. 最近よく負ける・苦手だと感じるキャラ
4. 自分の課題だと思うこと（対空、確反、コンボ、立ち回り、起き攻め、ドライブゲージ管理、メンタル等）
5. 今練習しているテーマや目標

## トーンと注意点
- フレンドリーだが軽すぎないプロコーチの口調
- 日本語で会話する
- 最初の挨拶で「これからあなた専属のコーチとして一緒に上達していきます」と伝える
- 各回答に対してリアクション（「いいキャラ選択ですね」「マスター帯なら基礎はしっかりしてますね」等）を入れてから次の質問へ
- 全ての情報が揃ったら「ヒアリング完了です。さっそくコーチングを始めます」と伝える

## 重要：回答のフォーマット
ヒアリングで得た全情報が揃ったら、最後のメッセージの末尾に以下のJSON形式でプロフィールデータを出力してください。
このJSONはシステムが自動で読み取ります。ユーザーには見えないので、必ず出力してください。

\`\`\`json:profile
{
  "mainCharacter": "キャラのslug",
  "subCharacters": ["サブキャラのslug"],
  "controlType": "classic または modern",
  "rank": "ランク帯",
  "masterRating": MR数値またはnull,
  "weakAgainst": ["苦手キャラのslug"],
  "challenges": ["課題1", "課題2"],
  "currentFocus": "現在の練習テーマ"
}
\`\`\`

キャラのslugは以下を使用:
ryu, luke, jamie, chunli, guile, kimberly, juri, ken, blanka, dhalsim, ehonda, deejay, manon, marisa, jp, zangief, lily, cammy, rashid, aki, ed, gouki, mbison, terry, mai, elena, cviper, sagat, alex`;
}

/** プロフィール情報をプロンプト用テキストに変換 */
function buildProfileSection(profile: UserProfile): string {
  const charNames: Record<string, string> = {
    ryu: "リュウ", luke: "ルーク", jamie: "ジェイミー", chunli: "春麗",
    guile: "ガイル", kimberly: "キンバリー", juri: "ジュリ", ken: "ケン",
    blanka: "ブランカ", dhalsim: "ダルシム", ehonda: "本田", deejay: "ディージェイ",
    manon: "マノン", marisa: "マリーザ", jp: "JP", zangief: "ザンギエフ",
    lily: "リリー", cammy: "キャミィ", rashid: "ラシード", aki: "A.K.I.",
    ed: "エド", gouki: "豪鬼", mbison: "ベガ", terry: "テリー",
    mai: "舞", elena: "エレナ", cviper: "C.ヴァイパー", sagat: "サガット",
    alex: "アレックス",
  };

  const mainName = charNames[profile.mainCharacter] || profile.mainCharacter;
  const subNames = profile.subCharacters.map(s => charNames[s] || s);
  const weakNames = profile.weakAgainst.map(s => charNames[s] || s);

  let text = `## 担当プレイヤーのプロフィール
- メインキャラ: ${mainName}（${profile.controlType}操作）
- ランク: ${profile.rank}`;

  if (profile.masterRating) {
    text += `（MR: ${profile.masterRating}）`;
  }

  if (subNames.length > 0) {
    text += `\n- サブキャラ: ${subNames.join("、")}`;
  }

  if (weakNames.length > 0) {
    text += `\n- 苦手キャラ: ${weakNames.join("、")}`;
  }

  if (profile.challenges.length > 0) {
    text += `\n- 本人が自覚している課題: ${profile.challenges.join("、")}`;
  }

  if (profile.currentFocus) {
    text += `\n- 現在の練習テーマ: ${profile.currentFocus}`;
  }

  text += `\n\n上記を踏まえ、このプレイヤーに最適化されたアドバイスを提供すること。`;

  return text;
}

/** フレームデータをLLMコンテキスト用のテキストに変換する */
export function formatFrameDataForContext(
  characterName: string,
  moves: Array<{
    skill: string;
    command: string | null;
    startup_frame: string;
    active_frame: string;
    recovery_frame: string;
    block_frame: string;
    hit_frame: string;
    damage: string;
    attribute: string;
    web_cancel: string;
    move_type: string;
  }>
): string {
  const lines = [`## ${characterName} のフレームデータ\n`];

  const typeLabels: Record<string, string> = {
    NORMAL: "通常技",
    UNIQUE: "特殊技",
    SPECIAL: "必殺技",
    SA: "スーパーアーツ",
    THROW: "投げ",
    COMMON: "共通技",
  };

  const grouped: Record<string, typeof moves> = {};
  for (const move of moves) {
    const type = move.move_type || "OTHER";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(move);
  }

  for (const [type, typeMoves] of Object.entries(grouped)) {
    lines.push(`### ${typeLabels[type] || type}`);
    for (const m of typeMoves) {
      const cmd = m.command || "";
      lines.push(
        `- ${m.skill} (${cmd}): 発生${m.startup_frame}F ガード${m.block_frame} ヒット${m.hit_frame} ダメージ${m.damage} ${m.attribute} ${m.web_cancel ? `[${m.web_cancel}]` : ""}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
