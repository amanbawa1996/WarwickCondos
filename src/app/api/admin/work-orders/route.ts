import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

function supabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// 🔁 Reuse SAME mapper shape as resident route
function mapWorkOrderRow(row: any) {
  return {
    _id: row.id,
    resident_id: row.resident_id,
    title: row.title,
    description: row.description,
    status: row.status === "in_progress" ? "in-progress" : row.status,
    priority: row.priority,

    unitNumber: row.unit_number,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerPhone: row.owner_phone,

    assigned_staff_id: row.assigned_staff_id ?? undefined,

    estimatedCost: row.estimated_cost ?? undefined,
    actualCost: row.actual_cost ?? undefined,

    paymentStatus: row.payment_status ?? "unpaid",
    
    paymentRequestedDate: row.payment_requested_date ?? undefined,

    scheduledDate: row.scheduled_date ?? undefined,
    completedDate: row.completed_date ?? undefined,

    _createdAt: row.created_at,
    _updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const rawSession = (await cookies()).get("warwick_session")?.value;
    if (!rawSession)
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(rawSession);
    if (!session?.loggedIn)
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    if (session.role !== "admin")
      return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const sb = supabaseServer();

    const { data, error } = await sb
      .from("work_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      { items: (data || []).map(mapWorkOrderRow) },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/admin/work-orders]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}