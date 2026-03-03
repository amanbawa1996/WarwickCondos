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

function mapRow(r: any) {
  return {
    _id: r.id,
    notificationType: r.notification_type,
    residentId: r.resident_id,
    residentName: r.resident_name,
    residentEmail: r.resident_email,
    unitNumber: r.unit_number,
    message: r.message,
    isRead: r.is_read,
    createdDate: r.created_at,
    adminId: r.admin_id,
  };
}

export async function GET(req: Request) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ items: [] }, { status: 200 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ items: [] }, { status: 200 });

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "1";

    let q = sb.from("notifications").select("*").order("created_at", { ascending: false });

    if (unreadOnly) q = q.eq("is_read", false);

    // ✅ Keep it simple:
    // - Admin sees admin_id 'all' (and optionally their own id later)
    // - Resident sees only their own (we need email for that; if you don't store it in session,
    //   we’ll keep bell admin-only for now)
    if (session.role === "admin") {
      q = q.eq("admin_id", "all");
    } else {
      // If you have session.email available, use it. If not, return empty for residents for now.
      // @ts-ignore
      q = q.eq("resident_id", session.userId);
    }


    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ items: (data || []).map(mapRow) }, { status: 200 });
  } catch (e) {
    console.error("[GET /api/notifications]", e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();
    const notification_type = String(body.notificationType || "").trim();
    const resident_id = String(body.residentId || "").trim();
    const message = String(body.message || "").trim();

    // NEW snapshot fields (optional)
    const resident_name = body.residentName ? String(body.residentName).trim() : null;
    const resident_email = body.residentEmail ? String(body.residentEmail).trim() : null;
    const unit_number = body.unitNumber ? String(body.unitNumber).trim() : null;

    if (!notification_type || !resident_id || !message) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const { error } = await sb.from("notifications").insert({
        notification_type,
        resident_id,
        resident_name,
        resident_email,
        unit_number,
        message,
        is_read: false,
        admin_id: "all",
    });

    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/notifications]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}