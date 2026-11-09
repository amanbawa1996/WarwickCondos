
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const cents = (value: unknown) =>
  Math.round(Number(value ?? 0) * 100);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const raw = (await cookies()).get("warwick_session")?.value;
    const session = raw ? await getSession(raw) : null;

    if (!session?.loggedIn || session.role !== "admin") {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403 }
      );
    }

    // Safety: test Stripe only for this first integration.
    if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
      return NextResponse.json(
        { error: "stripe_live_key_required" },
        { status: 403 }
      );
    }

    const { id: workOrderId } = await ctx.params;
    const { invoiceId } = await req.json();

    if (typeof invoiceId !== "string" || !invoiceId) {
      return NextResponse.json(
        { error: "invoice_id_required" },
        { status: 400 }
      );
    }

    const { data: invoice, error: invoiceError } = await sb
      .from("work_order_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("work_order_id", workOrderId)
      .eq("status", "draft")
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "invoice_draft_not_found" },
        { status: 404 }
      );
    }

    const { data: workOrder, error: workOrderError } = await sb
      .from("work_orders")
      .select(
        "id, resident_id, title, estimated_cost, actual_cost, total_charge_amount, processing_fee"
      )
      .eq("id", workOrderId)
      .single();

    if (workOrderError || !workOrder) {
      return NextResponse.json(
        { error: "work_order_not_found" },
        { status: 404 }
      );
    }

    const { data: resident, error: residentError } = await sb
      .from("residents")
      .select("id, stripe_customer_id")
      .eq("id", workOrder.resident_id)
      .single();

    if (residentError || !resident) {
      return NextResponse.json(
        { error: "resident_not_found" },
        { status: 404 }
      );
    }

    if (!resident.stripe_customer_id) {
      return NextResponse.json(
        { error: "resident_has_no_stripe_customer" },
        { status: 400 }
      );
    }

    const customerId = resident.stripe_customer_id;

    const { data: items, error: itemsError } = await sb
      .from("work_order_invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });

    if (itemsError) throw itemsError;

    if (!items?.length || items.length > 249) {
      return NextResponse.json(
        { error: "invalid_invoice_items" },
        { status: 400 }
      );
    }

    // Tax configuration is not implemented yet.
    // Do not silently omit taxes from taxable items.
    if (items.some((item) => item.taxable)) {
      return NextResponse.json(
        { error: "tax_configuration_required" },
        { status: 409 }
      );
    }

    // Initial-deposit and final-balance invoices only for now.
    if (!["initial_deposit", "final_balance"].includes(invoice.invoice_type)) {
      return NextResponse.json(
        { error: "adjustment_invoices_not_ready" },
        { status: 409 }
      );
    }

    const expectedBase =
      invoice.invoice_type === "initial_deposit"
        ? cents(workOrder.estimated_cost)
        : cents(workOrder.actual_cost);

    const itemSubtotal = items.reduce(
      (sum, item) => sum + cents(item.line_subtotal),
      0
    );

    if (expectedBase <= 0 || itemSubtotal !== expectedBase) {
      return NextResponse.json(
        { error: "invoice_does_not_match_work_order_cost" },
        { status: 409 }
      );
    }

    const alreadyPaidBase =
      cents(workOrder.total_charge_amount) -
      cents(workOrder.processing_fee);

    if (
      invoice.invoice_type === "initial_deposit" &&
      alreadyPaidBase > 0
    ) {
      return NextResponse.json(
        { error: "initial_deposit_already_paid" },
        { status: 409 }
      );
    }

    const priorPaid =
      invoice.invoice_type === "final_balance"
        ? alreadyPaidBase
        : 0;

    if (cents(invoice.prior_paid_amount) !== priorPaid) {
      return NextResponse.json(
        { error: "invoice_prior_payment_outdated" },
        { status: 409 }
      );
    }

    const expectedDue = itemSubtotal - priorPaid;

    if (expectedDue <= 0) {
      return NextResponse.json(
        { error: "no_invoice_balance_due" },
        { status: 409 }
      );
    }

    // Reuse an already-created Stripe draft on retries.
    let stripeInvoice: Stripe.Invoice;

    if (invoice.stripe_invoice_id) {
      stripeInvoice = await stripe.invoices.retrieve(
        invoice.stripe_invoice_id
      );

      if (stripeInvoice.status !== "draft") {
        return NextResponse.json(
          { error: "stripe_invoice_not_draft" },
          { status: 409 }
        );
      }
    } else {
      stripeInvoice = await stripe.invoices.create(
        {
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: 30,
          auto_advance: false,
          pending_invoice_items_behavior: "exclude",
          currency: "usd",
          description: `Warwick Condos - ${workOrder.title}`,
          metadata: {
            work_order_id: workOrderId,
            warwick_invoice_id: invoice.id,
            invoice_type: invoice.invoice_type,
          },
        },
        {
          idempotencyKey: `warwick-draft-${invoice.id}`,
        }
      );

      const { error: linkError } = await sb
        .from("work_order_invoices")
        .update({
          stripe_invoice_id: stripeInvoice.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (linkError) throw linkError;
    }

    // Add each saved pricing line to the Stripe draft.
    for (const item of items) {
      if (item.stripe_invoice_item_id) continue;

      const lineAmount = cents(item.line_subtotal);

      if (lineAmount <= 0) {
        throw new Error("Invoice contains a zero-value line");
      }

      const stripeItem = await stripe.invoiceItems.create(
        {
          customer: customerId,
          invoice: stripeInvoice.id,
          currency: "usd",
          amount: lineAmount,
          description:
            `${item.description} ` +
            `(${item.quantity} × $${Number(item.unit_price).toFixed(2)})`,
          metadata: {
            warwick_invoice_item_id: item.id,
            category: item.category,
          },
        },
        {
          idempotencyKey: `warwick-line-${invoice.id}-${item.id}`,
        }
      );

      const { error: linkItemError } = await sb
        .from("work_order_invoice_items")
        .update({ stripe_invoice_item_id: stripeItem.id })
        .eq("id", item.id)
        .eq("invoice_id", invoice.id);

      if (linkItemError) throw linkItemError;
    }

    // Represent an earlier deposit as a separate credit line.
    // This phase deliberately uses no automatic tax.
    if (priorPaid > 0) {
      await stripe.invoiceItems.create(
        {
          customer: customerId,
          invoice: stripeInvoice.id,
          currency: "usd",
          amount: -priorPaid,
          description: "Less previous payment received",
        },
        {
          idempotencyKey: `warwick-prior-paid-${invoice.id}`,
        }
      );
    }

    const result = await stripe.invoices.retrieve(stripeInvoice.id);

    if (result.status !== "draft" || result.amount_due !== expectedDue) {
      return NextResponse.json(
        { error: "stripe_invoice_total_mismatch" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      stripeInvoiceId: result.id,
      status: result.status,
      subtotal: result.subtotal / 100,
      amountDue: result.amount_due / 100,
    });
  } catch (error) {
    console.error("[create Stripe invoice draft]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "server_error",
      },
      { status: 500 }
    );
  }
}
