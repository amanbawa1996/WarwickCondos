import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function getAuthSession() {
  const raw = (await cookies()).get("warwick_session")?.value;

  if (!raw) return null;

  const session = await getSession(raw);
  if (!session) return null;

  return session;
}

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_logged_in" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const table = session.role === "admin" ? "admins" : "residents";

  const { data: profile, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json(
      { ok: false, error: "profile_not_found", role: session.role },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, role: session.role, profile },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: Request) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email_ad = String(body.email ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { ok: false, error: "first_and_last_name_required" },
      { status: 400 }
    );
  }

  const table = session.role === "admin" ? "admins" : "residents";

  const updateData =
    session.role === "admin"
      ? {
          full_name: `${firstName} ${lastName}`.trim(),
          phone_number: phone || null,
          email: email_ad || null
        }
      : {
          first_name: firstName,
          last_name: lastName,
          phone_number: phone || null,
          email: email_ad || null
        };

  const { data: profile, error } = await supabase
    .from(table)
    .update(updateData)
    .eq("id", session.userId)
    .select("*")
    .maybeSingle();

  if (error || !profile) {
    console.error("[PATCH /api/profile] error:", error);
    return NextResponse.json(
      { ok: false, error: "profile_update_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, role: session.role, profile },
    { headers: { "Cache-Control": "no-store" } }
  );
}