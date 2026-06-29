import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumePasswordResetToken } from "@/backend/auth";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function validPassword(password: string) {
  return password.length >= 8;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token || !validPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_input",
          message: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const tokenResult = await consumePasswordResetToken(token);

    if (!tokenResult) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_or_expired_link",
        },
        { status: 400 }
      );
    }

    const supabase = sb();

    const { error: passwordError } =
      await supabase.auth.admin.updateUserById(tokenResult.authUserId, {
        password,
      });

    if (passwordError) {
      console.error("[reset-password] Supabase password update failed", passwordError);

      return NextResponse.json(
        { ok: false, error: "password_update_failed" },
        { status: 500 }
      );
    }

    const { data: admin } = await supabase
      .from("admins")
      .select("id")
      .eq("auth_user_id", tokenResult.authUserId)
      .maybeSingle();

    const { data: resident } = admin
      ? { data: null }
      : await supabase
          .from("residents")
          .select("id")
          .eq("auth_user_id", tokenResult.authUserId)
          .maybeSingle();

    const profileId = admin?.id || resident?.id;

    if (profileId) {
      await supabase
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", profileId)
        .is("revoked_at", null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);

    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}