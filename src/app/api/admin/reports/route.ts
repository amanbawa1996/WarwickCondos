import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "not_in_use_yet" },
    { status: 501 }
  );
}