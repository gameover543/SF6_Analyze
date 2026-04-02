import { ImageResponse } from "next/og";

/** PWA用アイコン（512x512） */
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
          borderRadius: 96,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 192, fontWeight: 800, color: "#93c5fd", fontFamily: "system-ui", lineHeight: 1 }}>
          S6
        </span>
        <span style={{ fontSize: 72, fontWeight: 600, color: "#f3f4f6", fontFamily: "system-ui", letterSpacing: 8, lineHeight: 1 }}>
          COACH
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
