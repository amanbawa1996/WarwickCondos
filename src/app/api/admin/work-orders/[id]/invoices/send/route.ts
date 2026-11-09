
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

    const { id: workOrderId } = await ctx.params;
    const body = await req.json();
    const invoiceId = body?.invoiceId;

    if (typeof invoiceId !== "string") {
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
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "invoice_not_found" },
        { status: 404 }
      );
    }

    // Never send the same invoice twice through this action.
    if (invoice.sent_at) {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        invoiceNumber: invoice.stripe_invoice_number,
        hostedInvoiceUrl: invoice.stripe_hosted_invoice_url,
        invoicePdfUrl: invoice.stripe_invoice_pdf_url,
      });
    }

    if (invoice.status !== "draft" || !invoice.stripe_invoice_id) {
      return NextResponse.json(
        { error: "stripe_invoice_not_ready" },
        { status: 409 }
      );
    }

    const { data: workOrder, error: orderError } = await sb
      .from("work_orders")
      .select(
        "id, resident_id, estimated_cost, actual_cost, total_charge_amount, processing_fee"
      )
      .eq("id", workOrderId)
      .single();

    if (orderError || !workOrder) {
      return NextResponse.json(
        { error: "work_order_not_found" },
        { status: 404 }
      );
    }

    const { data: resident } = await sb
      .from("residents")
      .select("stripe_customer_id, email")
      .eq("id", workOrder.resident_id)
      .single();

    if (!resident?.stripe_customer_id || !resident.email) {
      return NextResponse.json(
        { error: "resident_billing_details_missing" },
        { status: 409 }
      );
    }

    const { data: items, error: itemError } = await sb
      .from("work_order_invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId);

    if (itemError || !items?.length) {
      return NextResponse.json(
        { error: "invoice_items_missing" },
        { status: 409 }
      );
    }

    // Never silently omit taxes or processing fees.
    // These must be configured before enabling taxed/fee-bearing invoices.
    if (
      items.some((item) => item.taxable) ||
      cents(invoice.tax_amount) !== 0 ||
      cents(invoice.processing_fee_amount) !== 0
    ) {
      return NextResponse.json(
        { error: "tax_or_processing_fee_configuration_required" },
        { status: 409 }
      );
    }

    const subtotal = items.reduce(
      (sum, item) => sum + cents(item.line_subtotal),
      0
    );

    const expectedBase =
      invoice.invoice_type === "initial_deposit"
        ? cents(workOrder.estimated_cost)
        : invoice.invoice_type === "final_balance"
          ? cents(workOrder.actual_cost)
          : 0;

    const alreadyPaidBase =
      cents(workOrder.total_charge_amount) -
      cents(workOrder.processing_fee);

    const priorPaid =
      invoice.invoice_type === "final_balance"
        ? Math.max(0, alreadyPaidBase)
        : 0;

    const expectedDue = subtotal - priorPaid;

    if (
      expectedBase <= 0 ||
      subtotal !== expectedBase ||
      expectedDue <= 0 ||
      cents(invoice.prior_paid_amount) !== priorPaid ||
      cents(invoice.total_due_amount) !== expectedDue
    ) {
      return NextResponse.json(
        { error: "invoice_amount_mismatch" },
        { status: 409 }
      );
    }

    const stripeInvoice = await stripe.invoices.retrieve(
      invoice.stripe_invoice_id
    );

    if (
      !stripeInvoice.livemode ||
      stripeInvoice.customer !== resident.stripe_customer_id ||
      stripeInvoice.collection_method !== "send_invoice"
    ) {
      return NextResponse.json(
        { error: "stripe_invoice_customer_or_mode_mismatch" },
        { status: 409 }
      );
    }

    if (
      stripeInvoice.status !== "draft" ||
      stripeInvoice.amount_due !== expectedDue ||
      stripeInvoice.total !== expectedDue
    ) {
      return NextResponse.json(
        { error: "stripe_invoice_not_ready_or_total_mismatch" },
        { status: 409 }
      );
    }

    const customer = await stripe.customers.retrieve(
      resident.stripe_customer_id
    );

    if ("deleted" in customer && customer.deleted) {
      return NextResponse.json(
        { error: "stripe_customer_deleted" },
        { status: 409 }
      );
    }

    if (!("email" in customer) || !customer.email) {
      return NextResponse.json(
        { error: "stripe_customer_email_missing" },
        { status: 409 }
      );
    }

    // Finalize without automatically charging the card.
    const finalized = await stripe.invoices.finalizeInvoice(
      stripeInvoice.id,
      { auto_advance: false },
      { idempotencyKey: `warwick-finalize-${invoice.id}` }
    );

    if (
      finalized.status !== "open" ||
      finalized.amount_due !== expectedDue
    ) {
      throw new Error("finalized_invoice_amount_mismatch");
    }

    // This sends the real invoice email to the Stripe customer.
    const sent = await stripe.invoices.sendInvoice(
      finalized.id,
      {},
      { idempotencyKey: `warwick-send-${invoice.id}` }
    );

    const { error: updateError } = await sb
      .from("work_order_invoices")
      .update({
        status: "open",
        stripe_invoice_number: sent.number,
        stripe_hosted_invoice_url: sent.hosted_invoice_url,
        stripe_invoice_pdf_url: sent.invoice_pdf,
        finalized_at: finalized.status_transitions.finalized_at
          ? new Date(
              finalized.status_transitions.finalized_at * 1000
            ).toISOString()
          : new Date().toISOString(),
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (updateError) {
      throw new Error(
        "Invoice sent by Stripe, but Warwick could not save its status. Check Stripe before retrying."
      );
    }

    return NextResponse.json({
      ok: true,
      invoiceNumber: sent.number,
      hostedInvoiceUrl: sent.hosted_invoice_url,
      invoicePdfUrl: sent.invoice_pdf,
      totalDue: sent.amount_due / 100,
    });
  } catch (error) {
    console.error("[send Warwick invoice]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "server_error",
      },
      { status: 500 }
    );
  }
}
