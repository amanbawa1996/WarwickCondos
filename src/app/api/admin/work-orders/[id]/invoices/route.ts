import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

type InvoiceType =
  | "initial_deposit"
  | "final_balance"
  | "adjustment";

type InvoiceItemInput = {
  category:
    | "labor"
    | "material"
    | "equipment"
    | "service"
    | "other";

  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  stripeTaxCode?: string | null;
};

type Body = {
  invoiceType: InvoiceType;
  notes?: string | null;
  items: InvoiceItemInput[];
};

function round2(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

async function requireAdmin() {
  const raw = (
    await cookies()
  ).get("warwick_session")?.value;

  if (!raw) return null;

  const session = await getSession(raw);

  if (
    !session?.loggedIn ||
    session.role !== "admin"
  ) {
    return null;
  }

  return session;
}

export async function GET(
  req: Request,
  ctx: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;

    const url = new URL(req.url);

    const invoiceType =
      url.searchParams.get("type");

    if (
      !invoiceType ||
      ![
        "initial_deposit",
        "final_balance",
        "adjustment",
      ].includes(invoiceType)
    ) {
      return NextResponse.json(
        { error: "invalid_invoice_type" },
        { status: 400 }
      );
    }

    const {
      data: invoice,
      error: invoiceError,
    } = await sb
      .from("work_order_invoices")
      .select("*")
      .eq("work_order_id", id)
      .eq("invoice_type", invoiceType)
      .eq("status", "draft")
      .order("revision_number", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      return NextResponse.json({
        item: null,
        items: [],
      });
    }

    const {
      data: invoiceItems,
      error: itemError,
    } = await sb
      .from("work_order_invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order", {
        ascending: true,
      });

    if (itemError) {
      throw itemError;
    }

    return NextResponse.json({
      item: invoice,
      items: invoiceItems || [],
    });
  } catch (error) {
    console.error(
      "[GET work-order invoices]",
      error
    );

    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  ctx: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;

    const body =
      (await req.json()) as Body;

    if (
      ![
        "initial_deposit",
        "final_balance",
        "adjustment",
      ].includes(body.invoiceType)
    ) {
      return NextResponse.json(
        { error: "invalid_invoice_type" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        { error: "invoice_items_required" },
        { status: 400 }
      );
    }

    const {
      data: workOrder,
      error: workOrderError,
    } = await sb
      .from("work_orders")
      .select(`
        id,
        resident_id,
        estimated_cost,
        actual_cost,
        processing_fee,
        total_charge_amount
      `)
      .eq("id", id)
      .single();

    if (
      workOrderError ||
      !workOrder
    ) {
      return NextResponse.json(
        { error: "work_order_not_found" },
        { status: 404 }
      );
    }

    const cleanedItems =
      body.items.map(
        (item, index) => {
          const description =
            String(
              item.description || ""
            ).trim();

          const quantity =
            Number(item.quantity);

          const unitPrice =
            Number(item.unitPrice);

          if (!description) {
            throw new Error(
              `Item ${
                index + 1
              } requires a description`
            );
          }

          if (
            !Number.isFinite(quantity) ||
            quantity <= 0
          ) {
            throw new Error(
              `Item ${
                index + 1
              } has an invalid quantity`
            );
          }

          if (
            !Number.isFinite(unitPrice) ||
            unitPrice < 0
          ) {
            throw new Error(
              `Item ${
                index + 1
              } has an invalid unit price`
            );
          }

          const lineSubtotal =
            round2(
              quantity * unitPrice
            );

          return {
            category:
              item.category,
            description,
            quantity,
            unit_price:
              round2(unitPrice),
            line_subtotal:
              lineSubtotal,
            taxable:
              Boolean(item.taxable),
            stripe_tax_code:
              item.stripeTaxCode ||
              null,
            sort_order: index,
          };
        }
      );

    const subtotal =
      round2(
        cleanedItems.reduce(
          (sum, item) =>
            sum +
            item.line_subtotal,
          0
        )
      );

    const alreadyPaidWithFees =
      Number(
        workOrder.total_charge_amount ??
          0
      );

    const alreadyPaidFees =
      Number(
        workOrder.processing_fee ??
          0
      );

    const amountPaidBase =
      Math.max(
        0,
        round2(
          alreadyPaidWithFees -
            alreadyPaidFees
        )
      );

    const priorPaidAmount =
      body.invoiceType ===
      "final_balance"
        ? amountPaidBase
        : 0;

    const totalDueBeforeTaxAndFee =
      Math.max(
        0,
        round2(
          subtotal -
            priorPaidAmount
        )
      );

    const {
      data: existingDraft,
      error: existingDraftError,
    } = await sb
      .from("work_order_invoices")
      .select(
        "id, revision_number"
      )
      .eq("work_order_id", id)
      .eq(
        "invoice_type",
        body.invoiceType
      )
      .eq("status", "draft")
      .order("revision_number", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingDraftError) {
      throw existingDraftError;
    }

    let invoiceId: string;

    if (existingDraft) {
      const {
        error: updateError,
      } = await sb
        .from(
          "work_order_invoices"
        )
        .update({
          subtotal_amount:
            subtotal,

          tax_amount: 0,

          prior_paid_amount:
            priorPaidAmount,

          processing_fee_amount:
            0,

          total_due_amount:
            totalDueBeforeTaxAndFee,

          notes:
            body.notes?.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingDraft.id
        );

      if (updateError) {
        throw updateError;
      }

      invoiceId =
        existingDraft.id;

      const {
        error: deleteError,
      } = await sb
        .from(
          "work_order_invoice_items"
        )
        .delete()
        .eq(
          "invoice_id",
          invoiceId
        );

      if (deleteError) {
        throw deleteError;
      }
    } else {
      const {
        data: latestInvoice,
        error: latestError,
      } = await sb
        .from(
          "work_order_invoices"
        )
        .select(
          "revision_number"
        )
        .eq(
          "work_order_id",
          id
        )
        .eq(
          "invoice_type",
          body.invoiceType
        )
        .order(
          "revision_number",
          { ascending: false }
        )
        .limit(1)
        .maybeSingle();

      if (latestError) {
        throw latestError;
      }

      const revisionNumber =
        Number(
          latestInvoice?.revision_number ??
            0
        ) + 1;

      const {
        data: createdInvoice,
        error: createError,
      } = await sb
        .from(
          "work_order_invoices"
        )
        .insert({
          work_order_id: id,

          resident_id:
            workOrder.resident_id,

          invoice_type:
            body.invoiceType,

          revision_number:
            revisionNumber,

          status: "draft",

          currency: "usd",

          subtotal_amount:
            subtotal,

          tax_amount: 0,

          prior_paid_amount:
            priorPaidAmount,

          processing_fee_amount:
            0,

          total_due_amount:
            totalDueBeforeTaxAndFee,

          notes:
            body.notes?.trim() ||
            null,
        })
        .select("*")
        .single();

      if (
        createError ||
        !createdInvoice
      ) {
        throw createError;
      }

      invoiceId =
        createdInvoice.id;
    }

    const rows =
      cleanedItems.map(
        (item) => ({
          invoice_id:
            invoiceId,
          ...item,
        })
      );

    const {
      error: itemInsertError,
    } = await sb
      .from(
        "work_order_invoice_items"
      )
      .insert(rows);

    if (itemInsertError) {
      throw itemInsertError;
    }

    const {
      data: savedInvoice,
      error: savedError,
    } = await sb
      .from(
        "work_order_invoices"
      )
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (savedError) {
      throw savedError;
    }

    return NextResponse.json({
      ok: true,
      item: savedInvoice,
    });
  } catch (error) {
    console.error(
      "[POST work-order invoices]",
      error
    );

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