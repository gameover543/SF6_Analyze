import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** favicon（32x32） */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#030712",
          borderRadius: 6,
          fontSize: 18,
          fontWeight: 800,
          color: "#93c5fd",
          fontFamily: "system-ui",
        }}
      >
        S6
      </div>
    ),
    { ...size }
  );
}
