import { NextRequest, NextResponse } from "next/server";
import { getCharacterFrameData } from "@/lib/frame-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const data = getCharacterFrameData(slug);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "キャラクターが見つかりません" },
      { status: 404 }
    );
  }
}
