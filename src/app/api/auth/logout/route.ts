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

export async function POST() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("warwick_session")?.value;

    // Revoke in DB if present
    if (raw) {
      const sessionHash = hashSession(raw);
      await supabase
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_hash", sessionHash);
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });

    // Clear cookie
    res.cookies.set("warwick_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e) {
    console.error("[POST /api/auth/logout]", e);

    // Still try to clear cookie even on error
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set("warwick_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }
}