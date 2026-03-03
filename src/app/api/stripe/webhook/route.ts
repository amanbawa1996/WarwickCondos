import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

function supabaseServer() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  console.log("[stripe webhook] HIT");

  const sig = req.headers.get("stripe-signature");
  console.log("[stripe webhook] has signature:", Boolean(sig));

  const rawBody = await req.text();
  console.log("[stripe webhook] raw body length:", rawBody.length);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("[stripe webhook] signature verification failed:", err?.message);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  console.log("[stripe webhook] event:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log("[stripe webhook] metadata:", session.metadata);

    const workOrderId = session.metadata?.workOrderId;
    if (!workOrderId) {
      console.warn("[stripe webhook] missing workOrderId metadata");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const sb = supabaseServer();

    const { data, error } = await sb
      .from("work_orders")
      .update({ payment_status: "paid", updated_at: new Date().toISOString() })
      .eq("id", workOrderId)
      .select("id,payment_status");

    console.log("[stripe webhook] update result:", { data, error });

    if (error) throw error;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}