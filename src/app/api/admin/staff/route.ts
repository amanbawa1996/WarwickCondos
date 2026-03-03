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

export async function POST(req: Request) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();

    // minimal validation
    const full_name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();
    const phone_number = body.phoneNumber ? String(body.phoneNumber).trim() : null;
    const employee_id = body.employeeId ? String(body.employeeId).trim() : null;

    if (!full_name || !email || !role) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("staff")
      .insert({
        full_name,
        email,
        role,
        phone_number,
        employee_id,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/admin/staff]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}