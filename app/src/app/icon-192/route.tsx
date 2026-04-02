import { ImageResponse } from "next/og";

/** PWA用アイコン（192x192） */
export async function GET() {
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
          borderRadius: 36,
          gap: 4,
        }}
      >
        <span style={{ fontSize: 72, fontWeight: 800, color: "#93c5fd", fontFamily: "system-ui", lineHeight: 1 }}>
          S6
        </span>
        <span style={{ fontSize: 28, fontWeight: 600, color: "#f3f4f6", fontFamily: "system-ui", letterSpacing: 4, lineHeight: 1 }}>
          COACH
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
