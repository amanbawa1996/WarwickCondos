import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

function supabaseServer() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { workOrderId } = await req.json();
    if (!workOrderId) return NextResponse.json({ error: "workOrderId_required" }, { status: 400 });

    const sb = supabaseServer();

    const { data: wo, error } = await sb
      .from("work_orders")
      .select("*")
      .eq("id", workOrderId)
      .maybeSingle();

    if (error) throw error;
    if (!wo) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Residents can only pay their own
    if (session.role === "resident" && wo.resident_id !== session.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (wo.payment_status === "paid") {
      return NextResponse.json({ error: "already_paid" }, { status: 409 });
    }

    // Amount source of truth: DB
    const amount = Number(wo.payment_request_amount ?? wo.actual_cost ?? wo.estimated_cost ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "invalid_payment_amount" }, { status: 400 });
    }

    // Stripe requires integer cents
    const amountCents = Math.round(amount * 100);

    const appUrl = process.env.APP_BASE_URL!;
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Warwick Work Order Payment",
              description: `${wo.title} (Unit ${wo.unit_number})`,
            },
          },
        },
      ],
      success_url: `${appUrl}/Dashboard?paid=1&workOrderId=${encodeURIComponent(wo.id)}`,
      cancel_url: `${appUrl}/payment?workOrderId=${encodeURIComponent(wo.id)}`,

      metadata: {
        workOrderId: wo.id,
        residentId: wo.resident_id,
      },
    });

    // Optional but useful: store the Checkout URL so Admin/Resident can re-open it
    await sb
      .from("work_orders")
      .update({
        payment_url: checkout.url,
        payment_requested_date: wo.payment_requested_date ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", wo.id);

    return NextResponse.json({ url: checkout.url }, { status: 200 });
  } catch (e) {
    console.error("[POST /api/stripe/checkout]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}