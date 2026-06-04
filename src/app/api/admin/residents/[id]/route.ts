import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";
import { sendResidentApprovedEmail } from "@/backend/postmark";

export const dynamic = "force-dynamic";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();
    const approvalStatus = String(body.approvalStatus || "").trim(); // pending|approved|rejected

    if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const supabase = sb();

    const { data: existingResident, error: fetchError } = await supabase
      .from("residents")
      .select("id, first_name, email, approval_status")
      .eq("id", id)
      .single();

    if (fetchError || !existingResident) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("residents")
      .update({ approval_status: approvalStatus })
      .eq("id", id);

    if (updateError) throw updateError;

    if (
      approvalStatus === "approved" &&
      existingResident.email &&
      existingResident.approval_status !== "approved"
    ) {
      try {
        await sendResidentApprovedEmail({
          to: existingResident.email,
          firstName: existingResident.first_name,
        });
      } catch (emailError) {
        console.error(
          "[PATCH /api/admin/residents/:id] approval email failed",
          emailError
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/admin/residents/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}