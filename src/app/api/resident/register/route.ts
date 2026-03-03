import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const first_name = String(body.firstName || "").trim();
    const last_name = String(body.lastName || "").trim();
    //const full_name = `${firstName} ${lastName}`.trim();

    const email = String(body.email || "").trim().toLowerCase();
    const phone_number = String(body.phoneNumber || "").trim() || null;
    const unit_number = String(body.unitNumber || "").trim() || null; // add if you have it in UI later

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    // Create resident as pending
    const { data: resident, error: rerr } = await sb
      .from("residents")
      .insert({
        first_name,
        last_name,
        email,
        phone_number,
        unit_number,
        approval_status: "pending",
      })
      .select("id, first_name, last_name, email, unit_number")
      .single();

    if (rerr) {
      // duplicate email
      if ((rerr as any).code === "23505") {
        return NextResponse.json({ error: "email_exists" }, { status: 409 });
      }
      throw rerr;
    }

    // Admin notification (admin bell)
    await sb.from("notifications").insert({
      notification_type: "NEW_RESIDENT_REGISTRATION",
      resident_id: resident.id,
      message: `New resident registration: ${resident.first_name}${resident.last_name}${resident.unit_number ? ` (Unit ${resident.unit_number})` : ""}`,
      is_read: false,
      admin_id: "all",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/resident/register]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}