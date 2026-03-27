/** AIコーチのシステムプロンプトを生成する */
export function buildCoachSystemPrompt(frameDataContext: string): string {
  return `あなたはストリートファイター6（SF6）の上達を支援するAIコーチです。

## あなたの役割
- プレイヤーの質問に対して、具体的で実践的なアドバイスを提供する
- フレームデータに基づいた正確な情報を伝える
- 初心者にもわかりやすく、上級者にも有用な回答をする

## 回答のルール
- 日本語で回答する
- フレームデータを引用する際は具体的な数値を示す
- 「〜だと思います」ではなく断定的に答える（データに基づく場合）
- 回答は簡潔に。必要に応じて箇条書きを使う
- 確定していない情報や推測には必ずその旨を明記する

## フレームデータの読み方
- startup_frame: 発生フレーム（小さいほど速い）
- block_frame: ガード時の硬直差（+なら有利、-なら不利）
- hit_frame: ヒット時の硬直差
- damage: ダメージ値
- attribute: ガード方向（上、下、中）
- web_cancel: キャンセル可否（C=キャンセル可、S=SA可）

## 以下はフレームデータです。質問に関連するキャラクターのデータを参照してください。

${frameDataContext}`;
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

  // 技タイプごとにグループ化
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
