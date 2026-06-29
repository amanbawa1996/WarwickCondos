import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendResidentRegistrationAlertEmail } from "@/backend/postmark";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function validPassword(password: string) {
  return password.length >= 8;
}

export async function POST(req: Request) {
  let createdAuthUserId: string | null = null;

  try {
    const body = await req.json();

    const first_name = String(body.firstName || "").trim();
    const last_name = String(body.lastName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone_number = String(body.phoneNumber || "").trim() || null;
    const unit_number = String(body.unitNumber || "").trim() || null;
    const password = String(body.password || "");

    if (!first_name || !last_name || !email || !password) {
      return NextResponse.json(
        { error: "validation_error" },
        { status: 400 }
      );
    }

    if (!validPassword(password)) {
      return NextResponse.json(
        {
          error: "weak_password",
          message: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const [{ data: existingResident }, { data: existingAdmin }] =
      await Promise.all([
        sb.from("residents").select("id").eq("email", email).maybeSingle(),
        sb.from("admins").select("id").eq("email", email).maybeSingle(),
      ]);

    if (existingResident || existingAdmin) {
      return NextResponse.json(
        { error: "email_exists" },
        { status: 409 }
      );
    }

    const { data: authUser, error: authError } =
      await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      console.error("[POST /api/resident/register] auth creation failed", authError);

      return NextResponse.json(
        { error: "account_creation_failed" },
        { status: 500 }
      );
    }

    createdAuthUserId = authUser.user.id;

    const { data: resident, error: residentError } = await sb
      .from("residents")
      .insert({
        first_name,
        last_name,
        email,
        phone_number,
        unit_number,
        auth_user_id: createdAuthUserId,
        approval_status: "pending",
      })
      .select("id, first_name, last_name, email, unit_number")
      .single();

    if (residentError) {
      await sb.auth.admin.deleteUser(createdAuthUserId);
      createdAuthUserId = null;

      if ((residentError as any).code === "23505") {
        return NextResponse.json(
          { error: "duplicate_record" },
          { status: 409 }
        );
      }

      throw residentError;
    }

    await sb.from("notifications").insert({
      notification_type: "NEW_RESIDENT_REGISTRATION",
      resident_id: resident.id,
      message: `New resident registration: ${resident.first_name} ${resident.last_name}${
        resident.unit_number ? ` (Unit ${resident.unit_number})` : ""
      }`,
      is_read: false,
      admin_id: "all",
    });

    try {
      await sendResidentRegistrationAlertEmail({
        residentName: `${resident.first_name} ${resident.last_name}`.trim(),
        residentEmail: resident.email,
        phoneNumber: phone_number,
        unitNumber: resident.unit_number,
      });
    } catch (emailError) {
      console.error(
        "[POST /api/resident/register] registration alert email failed",
        emailError
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/resident/register]", error);

    if (createdAuthUserId) {
      await sb.auth.admin.deleteUser(createdAuthUserId);
    }

    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}