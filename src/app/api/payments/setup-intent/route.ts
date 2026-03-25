import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function POST() {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;

    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "not_logged_in" },
        { status: 401 }
      );
    }

    const session = await getSession(raw);

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401 }
      );
    }

    if (session.role !== "resident") {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }

    const residentId = session.userId;

    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select("id, email, first_name, last_name, stripe_customer_id, approval_status")
      .eq("id", residentId)
      .single();

    if (residentError || !resident) {
      return NextResponse.json(
        { ok: false, error: "resident_not_found" },
        { status: 404 }
      );
    }

    if (resident.approval_status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "resident_not_approved" },
        { status: 403 }
      );
    }

    let stripeCustomerId = resident.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: resident.email,
        name: [resident.first_name, resident.last_name].filter(Boolean).join(" "),
        metadata: {
          resident_id: resident.id,
          role: "resident",
        },
      });

      stripeCustomerId = customer.id;

      const { error: updateError } = await supabase
        .from("residents")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", resident.id);

      if (updateError) {
        return NextResponse.json(
          { ok: false, error: "failed_to_save_stripe_customer" },
          { status: 500 }
        );
      }
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        resident_id: resident.id,
      },
    });

    return NextResponse.json({
      ok: true,
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
    });
  } catch (error) {
    console.error("POST /api/payments/setup-intent error:", error);

    return NextResponse.json(
      { ok: false, error: "internal_server_error" },
      { status: 500 }
    );
  }
}
