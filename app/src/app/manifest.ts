import type { MetadataRoute } from "next";

/** PWA用マニフェスト */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SF6 Coach - フレームデータ検索 × AI対戦メモ",
    short_name: "SF6 Coach",
    description: "ストリートファイター6のフレームデータ検索とAI対戦アドバイス",
    start_url: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#030712",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
