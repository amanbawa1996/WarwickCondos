import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();
    const approvalStatus = String(body.approvalStatus || "").trim(); // pending|approved|rejected

    if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const { error } = await sb()
      .from("residents")
      .update({ approval_status: approvalStatus })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/admin/residents/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}