import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple Touch Icon（180x180） */
export default function AppleIcon() {
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
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#93c5fd",
            fontFamily: "system-ui",
            lineHeight: 1,
          }}
        >
          S6
        </span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "#f3f4f6",
            fontFamily: "system-ui",
            letterSpacing: 3,
            lineHeight: 1,
          }}
        >
          COACH
        </span>
      </div>
    ),
    { ...size }
  );
}
