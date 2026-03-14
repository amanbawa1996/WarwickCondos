import { NextResponse } from "next/server";
import { createSession, verifyOtpCode } from "@/backend/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const otp = String(body?.otp ?? "").trim();

    if (!email || !otp || otp.length !== 6) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400 }
      );
    }

    const verified = await verifyOtpCode(email, otp);

    if (!verified) {
      return NextResponse.json(
        { ok: false, error: "invalid_or_expired_code" },
        { status: 401 }
      );
    }

    const sessionResult = await createSession(verified.email, verified.role);

    if (!sessionResult) {
      return NextResponse.json(
        { ok: false, error: "session_creation_failed" },
        { status: 401 }
      );
    }

    const { rawSession, session } = sessionResult;

    const redirectTo =
      verified.role === "admin" ? "/AdminDashboard" : "/ResidentHomePage";

    const res = NextResponse.json({
      ok: true,
      role: verified.role,
      redirectTo,
    });

    res.cookies.set({
      name: "warwick_session",
      value: rawSession,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expiresAt),
    });

    return res;
  } catch (error) {
    console.error("[VERIFY OTP ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}