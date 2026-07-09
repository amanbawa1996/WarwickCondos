import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";
import {sendStaffAssignmentEmail, sendPaymentRequestEmail} from "@/backend/postmark";

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
      .select(`id, assigned_staff_id, title, unit_number, priority, created_at, resident_id, actual_cost, estimated_cost, payment_status, payment_requested_date, processing_fee, total_charge_amount`)
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

    const costChanged = "estimatedCost" in body || "actualCost" in body;

    if (costChanged && !("paymentStatus" in body)) {
      const nextEstimatedCost =
        "estimatedCost" in body
          ? Number(body.estimatedCost ?? 0)
          : Number(existingWorkOrder.estimated_cost ?? 0);

      const nextActualCost =
        "actualCost" in body
          ? Number(body.actualCost ?? 0)
          : Number(existingWorkOrder.actual_cost ?? 0);

      const targetBaseAmount =
        nextActualCost > 0 ? nextActualCost : nextEstimatedCost;

      const totalProcessingFeesPaid = Number(existingWorkOrder.processing_fee ?? 0);
      const totalPaidWithFees = Number(existingWorkOrder.total_charge_amount ?? 0);

      const amountPaidBase = Math.max(
        0,
        Math.round((totalPaidWithFees - totalProcessingFeesPaid) * 100) / 100
      );

      const balanceDue = Math.max(
        0,
        Math.round((targetBaseAmount - amountPaidBase) * 100) / 100
      );

      updates.payment_status =
        targetBaseAmount > 0 && balanceDue <= 0 ? "paid" : "unpaid";
    }

    const { error: updateError } = await sb.from("work_orders").update(updates).eq("id", id);
    if (updateError) throw updateError;

    const paymentRequestTriggered =
      typeof body.paymentRequestedDate === "string" &&
      body.paymentRequestedDate.length > 0;

    if (paymentRequestTriggered) {
      try {
        const { data: resident, error: residentError } = await sb
          .from("residents")
          .select("id, email, first_name, last_name, unit_number")
          .eq("id", existingWorkOrder.resident_id)
          .single();

        if (!residentError && resident?.email) {
          const residentName = [resident.first_name, resident.last_name]
            .filter(Boolean)
            .join(" ");

          const appBaseUrl =
            process.env.APP_BASE_URL || "http://localhost:3000";

          const workOrderUrl = `${appBaseUrl}/work-order/${existingWorkOrder.id}`;

          await sendPaymentRequestEmail({
            to: resident.email,
            residentName,
            unitNumber: resident.unit_number ?? existingWorkOrder.unit_number,
            workOrderTitle: existingWorkOrder.title || "Work Order",
            actualCost: Number(existingWorkOrder.actual_cost ?? 0),
            workOrderUrl,
          });
        }
      } catch (emailError) {
        console.error(
          "[PATCH /api/admin/work-orders/:id] payment request email failed",
          emailError
        );
      }
    }

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