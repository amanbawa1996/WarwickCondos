import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";
import { sendStaffAssignmentEmail } from "@/backend/postmark";

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

    const { data: existingWorkOrder, error: existingError } = await sb
      .from("work_orders")
      .select("id, assigned_staff_id, title, unit_number, priority, created_at")
      .eq("id", id)
      .single();

    if (existingError || !existingWorkOrder) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const updates: any = { updated_at: new Date().toISOString() };

    if ("status" in body) updates.status = toDbStatus(body.status);
    if ("assigned_staff_id" in body) updates.assigned_staff_id = body.assigned_staff_id ?? null;

    if ("scheduledDate" in body) {
      updates.scheduled_date = body.scheduledDate || null;
    }

    if ("estimatedCost" in body) updates.estimated_cost = body.estimatedCost ?? null;
    if ("actualCost" in body) updates.actual_cost = body.actualCost ?? null;

    if ("paymentRequestedDate" in body) updates.payment_requested_date = body.paymentRequestedDate ?? null;

    if ("paymentStatus" in body) updates.payment_status = body.paymentStatus ?? null;

    const { error: updateError } = await sb.from("work_orders").update(updates).eq("id", id);
    if (updateError) throw updateError;

    const newAssignedStaffId = "assigned_staff_id" in body ? body.assigned_staff_id ?? null : undefined;

    const assignmentChanged =
      newAssignedStaffId !== undefined &&
      newAssignedStaffId !== existingWorkOrder.assigned_staff_id &&
      newAssignedStaffId !== null;

    if (assignmentChanged) {
      try {
        const { data: staffMember, error: staffError } = await sb
          .from("staff")
          .select("id, full_name, email")
          .eq("id", newAssignedStaffId)
          .single();

        if (!staffError && staffMember?.email) {
          await sendStaffAssignmentEmail({
            to: staffMember.email,
            staffName: staffMember.full_name,
            workOrderTitle: existingWorkOrder.title || "Work Order",
            unitNumber: existingWorkOrder.unit_number,
            priority: existingWorkOrder.priority,
          });
        }
      } catch (emailError) {
        console.error(
          "[PATCH /api/admin/work-orders/:id] staff assignment email failed",
          emailError
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/admin/work-orders/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}