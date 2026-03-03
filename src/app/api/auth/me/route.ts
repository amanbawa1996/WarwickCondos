import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { hashSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("warwick_session")?.value;

  if (!raw) {
    return NextResponse.json(
      { loggedIn: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const sessionHash = hashSession(raw);

  const { data: session, error } = await supabase
    .from("sessions")
    .select("user_id, role, expires_at, revoked_at")
    .eq("session_hash", sessionHash)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json(
      { loggedIn: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (session.revoked_at) {
    return NextResponse.json(
      { loggedIn: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const expiresAt = new Date(session.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return NextResponse.json(
      { loggedIn: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { loggedIn: true, role: session.role, userId: session.user_id },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
