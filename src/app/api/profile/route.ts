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

export async function GET() {
  const raw = (await cookies()).get("warwick_session")?.value;

  if (!raw) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { headers: { "Cache-Control": "no-store" } });
  }

  const session = await getSession(raw);
  if (!session) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { headers: { "Cache-Control": "no-store" } });
  }

  const table = session.role === "admin" ? "admins" : "residents";

  const { data: profile, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ ok: false, error: "profile_not_found", role: session.role }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { ok: true, role: session.role, profile },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
//   const { id } = await ctx.params;

//   const raw = (await cookies()).get("warwick_session")?.value;

//   if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

//   const session = await getSession(raw);

//   if (!session?) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
//   const body = await req.json()
//   const first_name = String(body.fi)
// }