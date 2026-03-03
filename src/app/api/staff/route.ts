import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth"; // adjust if needed

function supabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapStaffRow(row: any) {
  return {
    _id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone_number: row.phone_number,
    role: row.role,
    employee_id: row.employee_id,
    _createdDate: row.created_at,
  };
}

export async function GET() {
  try {
    const rawSession = (await cookies()).get("warwick_session")?.value;
    if (!rawSession) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(rawSession);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const sb = supabaseServer();

    const { data, error } = await sb
      .from("staff")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ items: (data || []).map(mapStaffRow) }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/staff]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}