import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";
import Stripe from "stripe";


export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const raw = (await cookies()).get("warwick_session")?.value;

    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "not_logged_in" },
        { status: 401 }
      );
    }

    const session = await getSession(raw);

    if (!session || session.role !== "resident") {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const paymentMethodId = body?.paymentMethodId;

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return NextResponse.json(
        { ok: false, error: "invalid_payment_method_id" },
        { status: 400 }
      );
    }

    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select("id, stripe_customer_id")
      .eq("id", session.userId)
      .single();

    if (residentError || !resident) {
      return NextResponse.json(
        { ok: false, error: "resident_not_found" },
        { status: 404 }
      );
    }

    if (!resident.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: "no_stripe_customer" },
        { status: 400 }
      );
    }

    const { data: workOrder, error: workOrderError } = await supabase
      .from("work_orders")
      .select("id, resident_id, payment_status")
      .eq("id", id)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { ok: false, error: "work_order_not_found" },
        { status: 404 }
      );
    }

    if (workOrder.resident_id !== session.userId) {
      return NextResponse.json(
        { ok: false, error: "forbidden_work_order" },
        { status: 403 }
      );
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (!paymentMethod || paymentMethod.type !== "card") {
      return NextResponse.json(
        { ok: false, error: "invalid_payment_method" },
        { status: 400 }
      );
    }

    if (paymentMethod.customer !== resident.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: "payment_method_not_owned_by_resident" },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabase
      .from("work_orders")
      .update({
        selected_payment_method_id: paymentMethodId,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: "failed_to_save_payment_method" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      selectedPaymentMethodId: paymentMethodId,
    });
  } catch (error) {
    console.error("PATCH /api/work-orders/[id]/payment error:", error);
    return NextResponse.json(
      { ok: false, error: "internal_server_error" },
      { status: 500 }
    );
  }
}