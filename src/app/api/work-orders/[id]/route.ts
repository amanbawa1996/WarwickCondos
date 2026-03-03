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

function mapRow(row: any) {
  return {
    _id: row.id,
    resident_id: row.resident_id,
    title: row.title,
    description: row.description,
    status: row.status === "in_progress" ? "in-progress" : row.status,
    priority: row.priority,
    // category: row.category,
    unitNumber: row.unit_number,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerPhone: row.owner_phone,
    assigned_staff_id: row.assigned_staff_id ?? undefined,
    scheduledDate: row.scheduled_date ?? undefined,
    completedDate: row.completed_date ?? undefined,
    estimatedCost: row.estimated_cost ?? undefined,
    actualCost: row.actual_cost ?? undefined,
    paymentStatus: row.payment_status ?? "unpaid",
    paymentRequestAmount: row.payment_request_amount ?? undefined,
    paymentRequestedDate: row.payment_requested_date ?? undefined,
    paymentUrl: row.payment_url ?? undefined,
    _createdAt: row.created_at,
    _updatedAt: row.updated_at,
  };
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await ctx.params
    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { data: row, error } = await sb
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // resident can only read their own
    if (session.role === "resident" && row.resident_id !== session.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    return NextResponse.json({ item: mapRow(row) }, { status: 200 });
  } catch (e) {
    console.error("[GET /api/work-orders/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}