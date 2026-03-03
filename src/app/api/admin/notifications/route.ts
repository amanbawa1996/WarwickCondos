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

    const notification_type = String(body.notificationType || "").trim();
    const resident_name = body.residentName ? String(body.residentName).trim() : null;
    const resident_email = body.residentEmail ? String(body.residentEmail).trim().toLowerCase() : null;
    const message = String(body.message || "").trim();

    if (!notification_type || !message) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("notifications")
      .insert({
        notification_type,
        resident_name,
        resident_email,
        message,
        is_read: false,
        admin_id: "all",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/admin/notifications]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}