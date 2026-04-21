import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const session = await getSession(raw);
    if (!session?.loggedIn) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    const { data: workOrder, error: workOrderError } = await sb
      .from("work_orders")
      .select(`
        id,
        title,
        resident_id,
        estimated_cost,
        actual_cost,
        payment_request_amount,
        payment_status,
        selected_payment_method_id,
        stripe_payment_intent_id
      `)
      .eq("id", id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json({ error: "work_order_not_found" }, { status: 404 });
    }

    if (String(workOrder.payment_status || "").toLowerCase() === "paid") {
      return NextResponse.json({ error: "already_paid" }, { status: 400 });
    }

    if (!workOrder.selected_payment_method_id) {
      return NextResponse.json(
        { error: "no_selected_payment_method" },
        { status: 400 }
      );
    }

    const { data: resident, error: residentError } = await sb
      .from("residents")
      .select("id, stripe_customer_id, email, unit_number, first_name, last_name")
      .eq("id", workOrder.resident_id)
      .single();

    if (residentError || !resident?.stripe_customer_id) {
      return NextResponse.json(
        { error: "resident_customer_not_found" },
        { status: 400 }
      );
    }

    const amountDollars =
      workOrder.payment_request_amount ??
      workOrder.actual_cost ??
      workOrder.estimated_cost ??
      0;

    const amount = Math.round(Number(amountDollars) * 100);

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(
      workOrder.selected_payment_method_id
    );

    if (!paymentMethod || paymentMethod.type !== "card" || !paymentMethod.card) {
      return NextResponse.json(
        { error: "invalid_payment_method" },
        { status: 400 }
      );
    }

    if (paymentMethod.customer !== resident.stripe_customer_id) {
      return NextResponse.json(
        { error: "payment_method_not_owned_by_resident" },
        { status: 403 }
      );
    }

    const description = `Warwick Condos - ${workOrder.title ?? "Work Order"} - Unit ${resident.unit_number ?? ""}`.trim();

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: resident.stripe_customer_id,
      payment_method: workOrder.selected_payment_method_id,
      confirm: true,
      off_session: true,
      receipt_email: resident.email,
      description,
      metadata: {
        work_order_id: workOrder.id,
        resident_id: workOrder.resident_id,
        unit_number: resident.unit_number ?? "",
      },
    });

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        {
          error: "payment_not_completed",
          stripeStatus: intent.status,
          paymentIntentId: intent.id,
        },
        { status: 400 }
      );
    }

    const { error: updateError } = await sb
      .from("work_orders")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: intent.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workOrder.id);

    if (updateError) {
      console.error("[POST /api/admin/work-orders/:id/charge] DB update failed", updateError);
      return NextResponse.json(
        {
          error: "payment_captured_but_db_update_failed",
          paymentIntentId: intent.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        paymentIntentId: intent.id,
        paymentStatus: "paid",
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[POST /api/admin/work-orders/:id/charge]", e);

    if (e?.type === "StripeCardError" || e?.code) {
      return NextResponse.json(
        {
          error: e.code || "stripe_payment_failed",
          message: e.message || "Payment failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}