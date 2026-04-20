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

export async function GET() {
  console.log("HIT /api/payments/methods");
  try {
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

    const { data: resident, error } = await supabase
      .from("residents")
      .select("id, stripe_customer_id")
      .eq("id", session.userId)
      .single();

    if (error || !resident) {
      return NextResponse.json(
        { ok: false, error: "resident_not_found" },
        { status: 404 }
      );
    }

    if (!resident.stripe_customer_id) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: resident.stripe_customer_id,
      type: "card",
    });

    const uniqueByFingerprint = new Map<string, typeof paymentMethods.data[number]>();

    for (const pm of paymentMethods.data) {
      const fingerprint = pm.card?.fingerprint;

      if (!fingerprint) {
        uniqueByFingerprint.set(pm.id, pm);
        continue;
      }

      if (!uniqueByFingerprint.has(fingerprint)) {
        uniqueByFingerprint.set(fingerprint, pm);
      }
    }
    
    const rawItems = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || "card",
      last4: pm.card?.last4 || "****",
      expMonth: pm.card?.exp_month || null,
      expYear: pm.card?.exp_year || null,
    }));

    const seen = new Set<string>();

    const items = rawItems.filter((item) => {
      const key = `${item.brand}-${item.last4}-${item.expMonth}-${item.expYear}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("GET /api/payments/methods error:", error);
    return NextResponse.json(
      { ok: false, error: "internal_server_error" },
      { status: 500 }
    );
  }
}