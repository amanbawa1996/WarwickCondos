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

function toDbStatus(ui?: string) {
  if (!ui) return undefined;
  return ui === "in-progress" ? "in_progress" : ui;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await ctx.params 
    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();

    const updates: any = { updated_at: new Date().toISOString() };

    if (body.status) updates.status = toDbStatus(body.status);
    if ("assigned_staff_id" in body) updates.assigned_staff_id = body.assigned_staff_id ?? null;

    if ("scheduledDate" in body) {
      updates.scheduled_date = body.scheduledDate ? new Date(body.scheduledDate).toISOString() : null;
    }

    if ("estimatedCost" in body) updates.estimated_cost = body.estimatedCost ?? null;
    if ("actualCost" in body) updates.actual_cost = body.actualCost ?? null;

    if ("paymentRequestAmount" in body) updates.payment_request_amount = body.paymentRequestAmount ?? null;
    if ("paymentRequestedDate" in body) updates.payment_requested_date = body.paymentRequestedDate ?? null;

    if (body.paymentStatus) updates.payment_status = body.paymentStatus;

    const { error } = await sb.from("work_orders").update(updates).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/admin/work-orders/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}