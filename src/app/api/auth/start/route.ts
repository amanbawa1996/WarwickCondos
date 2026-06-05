import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAllowlist } from "@/backend/allowlist";
import { generateOtpCode, hashOtp, storeOtp } from "@/backend/auth";
import { sendOtpEmail } from "@/backend/postmark";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, status: "invalid_email" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const supabase = sb();

    const { data: admin } = await supabase
      .from("admins")
      .select("email, is_active")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (admin?.email) {
      if (admin.is_active === false) {
        return NextResponse.json(
          { ok: false, status: "inactive_admin" },
          { status: 403 }
        );
      }

      const allow = await checkAllowlist(normalizedEmail);
      if (!allow || !allow.isActive) {
        return NextResponse.json(
          { ok: false, status: "not_allowed" },
          { status: 403 }
        );
      }

      const otp = generateOtpCode();
      const otpHash = hashOtp(allow.email, otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storeOtp(allow.email, allow.role, otpHash, expiresAt);

      try {
        await sendOtpEmail({
          to: allow.email,
          otp,
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[DEV OTP]", { email: allow.email, otp });
          console.log("[DEV NOTE] Postmark send failed. Error:", e);
        } else {
          console.log("[AUTH START EMAIL ERROR]", e);
        }
      }

      return NextResponse.json({ ok: true, status: "otp_sent" });
    }

    const { data: resident } = await supabase
      .from("residents")
      .select("email, approval_status")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!resident?.email) {
      return NextResponse.json(
        { ok: false, status: "not_found" },
        { status: 404 }
      );
    }

    if (resident.approval_status !== "approved") {
      return NextResponse.json(
        { ok: false, status: "pending_approval" },
        { status: 403 }
      );
    }

    const allow = await checkAllowlist(normalizedEmail);
    if (!allow || !allow.isActive) {
      return NextResponse.json(
        { ok: false, status: "not_allowed" },
        { status: 403 }
      );
    }

    const otp = generateOtpCode();
    const otpHash = hashOtp(allow.email, otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storeOtp(allow.email, allow.role, otpHash, expiresAt);

    try {
      await sendOtpEmail({
        to: allow.email,
        otp,
      });
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEV OTP]", { email: allow.email, otp });
        console.log("[DEV NOTE] Postmark send failed. Error:", e);
      } else {
        console.log("[AUTH START EMAIL ERROR]", e);
      }
    }

    return NextResponse.json({ ok: true, status: "otp_sent" });
  } catch (err) {
    console.error("[POST /api/auth/start]", err);
    return NextResponse.json(
      { ok: false, status: "server_error" },
      { status: 500 }
    );
  }
}