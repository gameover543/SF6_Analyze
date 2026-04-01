/**
 * キャラクターslug → 日本語名マップ（全ファイル共通）
 *
 * slug体系の注意:
 * - フレームデータ / プロフィール: "ehonda" を使用
 * - ナレッジデータ (_coverage.json 等): "honda" を使用
 * 両方を含めることで、どちらのslugでも日本語名を解決できる。
 */
export const CHAR_JP: Record<string, string> = {
  ryu: "リュウ", luke: "ルーク", jamie: "ジェイミー", chunli: "春麗",
  guile: "ガイル", kimberly: "キンバリー", juri: "ジュリ", ken: "ケン",
  blanka: "ブランカ", dhalsim: "ダルシム",
  ehonda: "本田", honda: "本田",  // フレームデータは ehonda、ナレッジデータは honda
  deejay: "ディージェイ",
  manon: "マノン", marisa: "マリーザ", jp: "JP", zangief: "ザンギエフ",
  lily: "リリー", cammy: "キャミィ", rashid: "ラシード", aki: "A.K.I.",
  ed: "エド", gouki: "豪鬼", mbison: "ベガ", terry: "テリー",
  mai: "舞", elena: "エレナ", cviper: "C.ヴァイパー", sagat: "サガット",
  alex: "アレックス",
};
