import { NextResponse } from "next/server";


import {
  verifyToken,
  createSession,
} from "@/backend/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const APP_BASE_URL = new URL(req.url).origin;
  const rawToken = url.searchParams.get("token");

  // Missing token → go back to login
  if (!rawToken) {
    return NextResponse.redirect(new URL("/login", APP_BASE_URL));
  }

  // 1) Verify + consume magic link token
  const verified = await verifyToken(rawToken);
  if (!verified) {
    return NextResponse.redirect(new URL("/login", APP_BASE_URL));
  }

  const { email, role } = verified;

  // 2) Create session (checks admin.is_active / resident.approval_status === 'approved')
  const sessionResult = await createSession(email, role);
    console.log("[VERIFY] createSession result:", {
    ok: !!sessionResult,
    email,
    role,
    expiresAt: sessionResult?.session?.expiresAt,
  });

  if (!sessionResult) {
    return NextResponse.redirect(new URL("/login", APP_BASE_URL));
  }

  const { rawSession, session } = sessionResult;

  // 3) Decide redirect path (THIS is where your Router.tsx comes in)
  const redirectPath =
    role === "admin"
      ? "/AdminDashboard"
      : "/ResidentHomePage";

  const res = NextResponse.redirect(
    new URL(redirectPath, APP_BASE_URL)
  );

  // 4) Set HttpOnly session cookie
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
}
