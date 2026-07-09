import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendPaymentReceiptEmail } from "@/backend/postmark";
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function calcProcessingFee(baseAmount: number) {
  const percent = Number(process.env.STRIPE_FEE_PERCENT ?? "2.9") / 100;
  const fixed = Number(process.env.STRIPE_FEE_FIXED ?? "0.30");
  
  const totalToCharge = (baseAmount + fixed) / (1 - percent);
  return round2(totalToCharge - baseAmount)
}

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
        owner_email,
        estimated_cost,
        actual_cost,
        payment_status,
        selected_payment_method_id,
        stripe_payment_intent_id,
        processing_fee,
        total_charge_amount
      `)
      .eq("id", id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json({ error: workOrderError }, { status: 404 });
    }


    if (!workOrder.selected_payment_method_id) {
      return NextResponse.json(
        { error: "no_selected_payment_method" },
        { status: 400 }
      );
    }

    const currentProcessingFeeDollars = Number(workOrder.processing_fee ?? 0);
    const currentTotalChargedDollars = Number(workOrder.total_charge_amount ?? 0);

    const baseAmountAlreadyPaidDollars = round2(
      Math.max(0, currentTotalChargedDollars - currentProcessingFeeDollars)
    );

    // actual_cost = final cost. If final cost is not set yet, fall back to estimated_cost = initial deposit.
    const targetBaseAmountDollars =
      Number(workOrder.actual_cost ?? 0) > 0
        ? Number(workOrder.actual_cost ?? 0)
        : Number(workOrder.estimated_cost ?? 0);

    if (!targetBaseAmountDollars || targetBaseAmountDollars <= 0) {
      return NextResponse.json(
        { error: "charge_amount_required" },
        { status: 400 }
      );
    }

    const balanceDueDollars = round2(
      Math.max(0, targetBaseAmountDollars - baseAmountAlreadyPaidDollars)
    );

    if (!balanceDueDollars || balanceDueDollars <= 0) {
      return NextResponse.json(
        {
          error: "nothing_to_charge",
          targetBaseAmount: targetBaseAmountDollars,
          baseAmountAlreadyPaid: baseAmountAlreadyPaidDollars,
        },
        { status: 400 }
      );
    }

    const processingFeeDollars = calcProcessingFee(balanceDueDollars);
    const totalChargeAmountDollars = round2(
      balanceDueDollars + processingFeeDollars
    );

    const amount = Math.round(totalChargeAmountDollars * 100);

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
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

    if (!resident.email) {
      return NextResponse.json(
        { error: "resident_email_missing" },
        { status: 400 }
      );
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

    const idempotencyKey = [
      "work_order_charge",
      workOrder.id,
      targetBaseAmountDollars.toFixed(2),
      baseAmountAlreadyPaidDollars.toFixed(2),
      balanceDueDollars.toFixed(2),
    ].join("_");


    const intent = await stripe.paymentIntents.create(
      {
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
          resident_id: resident.id,
          resident_email: resident.email,
          owner_email: workOrder.owner_email ?? "",
          unit_number: resident.unit_number ?? "",
          target_base_amount: targetBaseAmountDollars.toFixed(2),
          base_amount_already_paid: baseAmountAlreadyPaidDollars.toFixed(2),
          balance_due: balanceDueDollars.toFixed(2),
          processing_fee_for_this_charge: processingFeeDollars.toFixed(2),
          total_charge_amount_for_this_charge: totalChargeAmountDollars.toFixed(2),
        },
      },
      {
        idempotencyKey,
      }
    );

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

    const now = new Date().toISOString();

    const { error: updateError } = await sb
      .from("work_orders")
      .update({
        processing_fee: round2(currentProcessingFeeDollars + processingFeeDollars),
        total_charge_amount: round2(currentTotalChargedDollars + totalChargeAmountDollars),
        payment_status: "paid",
        stripe_payment_intent_id: intent.id,
        paid_at: now,
        updated_at: now,
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

    try {
      await sendPaymentReceiptEmail({
        to: resident.email,
        residentName: [resident.first_name, resident.last_name].filter(Boolean).join(" "),
        unitNumber: resident.unit_number ?? "",
        workOrderTitle: workOrder.title ?? "Work Order",
        actualCost: balanceDueDollars,
        processingFee: processingFeeDollars,
        totalChargeAmount: totalChargeAmountDollars,
        paymentDate: new Date(now).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        cardBrand: paymentMethod.card?.brand ?? "",
        cardLast4: paymentMethod.card?.last4 ?? "",
        paymentIntentId: intent.id,
      });
    } catch (emailError) {
      console.error(
        "[POST /api/admin/work-orders/:id/charge] receipt email failed",
        emailError
      );
    }

    return NextResponse.json(
      {
        ok: true,
        paymentIntentId: intent.id,
        paymentStatus: "paid",
        actualCost: balanceDueDollars,
        processingFee: processingFeeDollars,
        totalChargeAmount: totalChargeAmountDollars,
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