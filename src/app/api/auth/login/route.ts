import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSession } from "@/backend/auth";

function serviceSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function authSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await authSupabase().auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 }
      );
    }

    const authUserId = authData.user.id;
    const sb = serviceSupabase();

    const { data: admin } = await sb
      .from("admins")
      .select("id, email, is_active")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (admin) {
      if (admin.is_active === false) {
        return NextResponse.json(
          { ok: false, error: "account_inactive" },
          { status: 403 }
        );
      }

      const sessionResult = await createSession(admin.email, "admin");

      if (!sessionResult) {
        return NextResponse.json(
          { ok: false, error: "session_creation_failed" },
          { status: 401 }
        );
      }

      const res = NextResponse.json({
        ok: true,
        role: "admin",
        redirectTo: "/AdminDashboard",
      });

      res.cookies.set({
        name: "warwick_session",
        value: sessionResult.rawSession,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: sessionResult.session.expiresAt,
      });

      return res;
    }

    const { data: resident } = await sb
      .from("residents")
      .select("id, email, approval_status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!resident) {
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 }
      );
    }

    if (resident.approval_status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "pending_approval" },
        { status: 403 }
      );
    }

    const sessionResult = await createSession(resident.email, "resident");

    if (!sessionResult) {
      return NextResponse.json(
        { ok: false, error: "session_creation_failed" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      role: "resident",
      redirectTo: "/ResidentHomePage",
    });

    res.cookies.set({
      name: "warwick_session",
      value: sessionResult.rawSession,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: sessionResult.session.expiresAt,
    });

    return res;
  } catch (error) {
    console.error("[POST /api/auth/login]", error);

    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}