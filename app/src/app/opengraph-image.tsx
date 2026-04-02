import { ImageResponse } from "next/og";

export const alt = "SF6 Coach - フレームデータ検索 × AI対戦メモ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** デフォルトOGP画像 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#030712",
          fontFamily: "system-ui",
        }}
      >
        {/* ロゴ */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 96, fontWeight: 800, color: "#93c5fd" }}>
            S6
          </span>
          <span style={{ fontSize: 72, fontWeight: 700, color: "#f3f4f6" }}>
            Coach
          </span>
        </div>

        {/* サブタイトル */}
        <span style={{ fontSize: 32, color: "#9ca3af", marginBottom: 48 }}>
          フレームデータ検索 × AI対戦メモ
        </span>

        {/* 機能バッジ */}
        <div style={{ display: "flex", gap: 24 }}>
          {["全29キャラ対応", "Classic / Modern", "AIアドバイス"].map(
            (text) => (
              <span
                key={text}
                style={{
                  fontSize: 22,
                  color: "#f3f4f6",
                  background: "#1f2937",
                  padding: "10px 24px",
                  borderRadius: 12,
                  border: "1px solid #374151",
                }}
              >
                {text}
              </span>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
