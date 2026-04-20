import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});


const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function mapSelectedPaymentMethod(paymentMethod: Stripe.PaymentMethod | null) {
  if (!paymentMethod || paymentMethod.type !== "card" || !paymentMethod.card) {
    return null;
  }

  return {
    id: paymentMethod.id,
    brand: paymentMethod.card.brand ?? "",
    last4: paymentMethod.card.last4 ?? "",
    expMonth: paymentMethod.card.exp_month ?? null,
    expYear: paymentMethod.card.exp_year ?? null,
  };
}

function mapRow(row: any, selectedPaymentMethod: any = null) {
  return {
    _id: row.id,
    resident_id: row.resident_id,
    title: row.title,
    description: row.description,
    status: row.status === "in_progress" ? "in-progress" : row.status,
    priority: row.priority,
    category: row.category ?? undefined,
    unitNumber: row.unit_number,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerPhone: row.owner_phone,
    assigned_staff_id: row.assigned_staff_id ?? undefined,
    scheduledDate: row.scheduled_date ?? undefined,
    completedDate: row.completed_date ?? undefined,
    estimatedCost: row.estimated_cost ?? undefined,
    actualCost: row.actual_cost ?? undefined,
    paymentStatus: row.payment_status ?? "unpaid",
    paymentRequestAmount: row.payment_request_amount ?? undefined,
    paymentRequestedDate: row.payment_requested_date ?? undefined,
    paymentUrl: row.payment_url ?? undefined,
    selectedPaymentMethodId: row.selected_payment_method_id ?? null,
    selectedPaymentMethod,
    _createdAt: row.created_at,
    _updatedAt: row.updated_at,
  };
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await ctx.params
    const session = await getSession(raw);
    if (!session?.loggedIn) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { data: row, error } = await sb
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // resident can only read their own
    if (session.role === "resident" && row.resident_id !== session.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    let selectedPaymentMethod = null;

    if (row.selected_payment_method_id) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(
          row.selected_payment_method_id
        );

        selectedPaymentMethod = mapSelectedPaymentMethod(paymentMethod);
      } catch (pmError) {
        console.error(
          `[GET /api/work-orders/${id}] failed to fetch Stripe payment method`,
          pmError
        );
        selectedPaymentMethod = null;
      }
    }


    return NextResponse.json({ item: mapRow(row, selectedPaymentMethod) }, { status: 200 });
  } catch (e) {
    console.error("[GET /api/work-orders/:id]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { selectedPaymentMethodId } = body;

    const raw = (await cookies()).get("warwick_session")?.value;
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "not_logged_in" },
        { status: 401 }
      );
    }

    const session = await getSession(raw);
    if (!session?.loggedIn) {
      return NextResponse.json(
        { ok: false, error: "not_logged_in" },
        { status: 401 }
      );
    }

    if (session.role !== "resident" && session.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }

    const { data: existing, error: existingError } = await sb
      .from("work_orders")
      .select("id, resident_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { ok: false, error: "work_order_not_found" },
        { status: 404 }
      );
    }

    if (session.role === "resident" && existing.resident_id !== session.userId) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }

    let safePaymentMethodId: string | null = null;

    if (selectedPaymentMethodId) {
      const pm = await stripe.paymentMethods.retrieve(selectedPaymentMethodId);

      if (!pm || pm.type !== "card" || !pm.card) {
        return NextResponse.json(
          { ok: false, error: "invalid_payment_method" },
          { status: 400 }
        );
      }

      safePaymentMethodId = pm.id;

      if (session.role === "resident") {
        const { data: resident, error: residentError } = await sb
          .from("residents")
          .select("id, stripe_customer_id")
          .eq("id", session.userId)
          .single();

        if (residentError || !resident?.stripe_customer_id) {
          return NextResponse.json(
            { ok: false, error: "resident_customer_not_found" },
            { status: 400 }
          );
        }

        if (pm.customer !== resident.stripe_customer_id) {
          return NextResponse.json(
            { ok: false, error: "payment_method_not_owned_by_resident" },
            { status: 403 }
          );
        }
      }
    }

    const { data: updated, error: updateError } = await sb
      .from("work_orders")
      .update({
        selected_payment_method_id: safePaymentMethodId,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/work-orders/[id]] update error:", updateError);
      return NextResponse.json(
        { ok: false, error: "update_failed" },
        { status: 500 }
      );
    }

    let selectedPaymentMethod = null;
    if (updated.selected_payment_method_id) {
      try {
        const pm = await stripe.paymentMethods.retrieve(
          updated.selected_payment_method_id
        );
        selectedPaymentMethod = mapSelectedPaymentMethod(pm);
      } catch (error) {
        console.error(
          "[PATCH /api/work-orders/[id]] payment method fetch error:",
          error
        );
      }
    }

    return NextResponse.json({
      ok: true,
      item: mapRow(updated, selectedPaymentMethod),
    });
  } catch (error) {
    console.error("[PATCH /api/work-orders/[id]] unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}