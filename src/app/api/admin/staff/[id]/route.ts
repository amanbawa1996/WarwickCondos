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
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();

    const updates: any = {};
    if ("full_name" in body) updates.full_name = String(body.full_name || "").trim();
    if ("email" in body) updates.email = String(body.email || "").trim().toLowerCase();
    if ("role" in body) updates.role = String(body.role || "").trim();
    if ("phone_number" in body) updates.phone_number = body.phone_number ? String(body.phone_number).trim() : null;
    if ("employee_id" in body) updates.employee_id = body.employee_id ? String(body.employee_id).trim() : null;

    // minimal required fields
    if (!updates.full_name || !updates.email || !updates.role) {
      // Only enforce if they were provided; easiest approach:
      // If any of these keys are present but empty, reject.
      if ("name" in body || "email" in body || "role" in body) {
        return NextResponse.json({ error: "validation_error" }, { status: 400 });
      }
    }

    const { error } = await sb.from("staff").update(updates).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/admin/staff/:id]", e);
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
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { error } = await sb.from("staff").update({ is_active: false }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[DELETE /api/admin/staff/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}