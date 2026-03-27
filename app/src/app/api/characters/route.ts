import { NextResponse } from "next/server";
import { CHARACTER_LIST } from "@/lib/frame-data";

export async function GET() {
  return NextResponse.json(CHARACTER_LIST);
}
