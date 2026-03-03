import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const isRead = "isRead" in body ? !!body.isRead : true;

    const { error } = await sb.from("notifications").update({ is_read: isRead }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/notifications/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { error } = await sb.from("notifications").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[DELETE /api/notifications/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}