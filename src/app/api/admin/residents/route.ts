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

// map DB -> your existing UI entity-ish shape
function mapResidentRow(r: any) {
  // Your old UI used firstName/lastName + requestDate.
  // Your DB is full_name; split safely.
//   const full = String(r.full_name || "").trim();
//   const parts = full ? full.split(" ") : [];
  const firstName = String(r.first_name || "").trim();
  const lastName = String(r.last_name || "").trim();

  return {
    _id: r.id,
    firstName,
    lastName,
    //full_name: r.full_name,
    email: r.email,
    phoneNumber: r.phone_number,
    unitNumber: r.unit_number,
    approvalStatus: r.approval_status,
    //requestDate: r.created_at,
    _createdDate: r.created_at,
    //_updatedDate: r.updated_at ?? r.created_at,
  };
}

export async function GET() {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { data, error } = await sb()
      .from("residents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ items: (data || []).map(mapResidentRow) }, { status: 200 });
  } catch (e) {
    console.error("[GET /api/admin/residents]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}