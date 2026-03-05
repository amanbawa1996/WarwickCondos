import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth"; // adjust path to your actual backend/auth.ts

type Body = {
  title: string;
  description: string;
  priority?: string | null;   // low|medium|high|urgent OR Low/Medium/etc (we normalize)

  // Wix-style snapshot fields (editable)
  unitNumber?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
};

function supabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function canonPriority(input: string | null | undefined) {
  const p = String(input || "").trim().toLowerCase();
  if (p === "low") return "low";
  if (p === "medium") return "medium";
  if (p === "high") return "high";
  if (p === "urgent") return "urgent";
  // Accept Wix Title Case too
  if (p === "low".toLowerCase()) return "low";
  return "medium";
}



// map DB row -> old Wix-ish WorkOrder shape used by your TS types/UI
function mapWorkOrderRow(row: any) {
    const status =
        row.status === "in_progress" ? "in-progress" : row.status; // UI expects in-progress

    return {
        _id: row.id,
        title: row.title,
        description: row.description,
        status,
        priority: row.priority,
        category: row.category,

        unitNumber: row.unit_number,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        ownerPhone: row.owner_phone,

        assigned_staff_id: row.assigned_staff_id ?? undefined,

        estimatedCost: row.estimated_cost ?? undefined,
        actualCost: row.actual_cost ?? undefined,

        paymentStatus: row.payment_status ?? undefined,
        paymentRequestAmount: row.payment_request_amount ?? undefined,
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
        if (!rawSession) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

        const session = await getSession(rawSession);
        if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
        if (session.role !== "resident") return NextResponse.json({ error: "forbidden" }, { status: 403 });

        const sb = supabaseServer();

        const { data, error } = await sb
        .from("work_orders")
        .select("*")
        .eq("resident_id", session.userId)
        .order("created_at", { ascending: false });

        if (error) throw error;

        // Return Wix-like {items: []} so your dashboard code pattern stays familiar
        return NextResponse.json({ items: (data || []).map(mapWorkOrderRow) }, { status: 200 });
    } catch (err) {
        console.error("[GET /api/resident/work-orders]", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
  try {
    const rawSession = (await cookies()).get("warwick_session")?.value;
    if (!rawSession) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(rawSession);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "resident") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = (await req.json()) as Body;
    console.log("[resident/work-orders] raw body =", body);
    console.log("[resident/work-orders] unitNumber =", (body as any).unitNumber, "unit_number =", (body as any).unit_number);
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    
    const priority = canonPriority(body.priority);

    // Wix-style fields (editable)
    const unitNumber = body.unitNumber ? String(body.unitNumber).trim() : "";
    const ownerName = body.ownerName ? String(body.ownerName).trim() : null;
    const ownerEmail = body.ownerEmail ? String(body.ownerEmail).trim() : null;
    const ownerPhone = body.ownerPhone ? String(body.ownerPhone).trim() : null;

    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "description_required" }, { status: 400 });

    // If you want unitNumber required like Wix often did:
    if (!unitNumber) return NextResponse.json({ error: "unitNumber_required" }, { status: 400 });

    const sb = supabaseServer();

    const { data: created, error } = await sb
      .from("work_orders")
      .insert({
        resident_id: session.userId,      // security/scoping (server-enforced)
        unit_number: unitNumber,          // store what user typed
        owner_name: ownerName,
        owner_email: ownerEmail,
        owner_phone: ownerPhone,

        title,
        description,
        
        priority,

        status: "pending",
        payment_status: "unpaid",         // placeholder
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ workOrder: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/resident/work-orders]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}