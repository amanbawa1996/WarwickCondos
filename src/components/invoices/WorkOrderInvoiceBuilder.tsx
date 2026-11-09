"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import styles from "./WorkOrderInvoiceBuilder.module.css";

type InvoiceType =
  | "initial_deposit"
  | "final_balance"
  | "adjustment";

type InvoiceCategory =
  | "labor"
  | "material"
  | "equipment"
  | "service"
  | "other";

type InvoiceItem = {
  id?: string;
  category: InvoiceCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  stripeTaxCode?: string | null;
};

type Props = {
  workOrderId: string;
  initialDeposit: number;
  finalCost: number;
  amountPaidBase: number;
};

function newLine(): InvoiceItem {
  return {
    category: "service",
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxable: false,
    stripeTaxCode: null,
  };
}

export default function WorkOrderInvoiceBuilder({
  workOrderId,
  initialDeposit,
  finalCost,
  amountPaidBase,
}: Props) {
  const { toast } = useToast();

  const [invoiceType, setInvoiceType] =
    useState<InvoiceType>(
      finalCost > 0 ? "final_balance" : "initial_deposit"
    );

  const [items, setItems] = useState<InvoiceItem[]>([
    newLine(),
  ]);

  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isCreatingStripeDraft, setIsCreatingStripeDraft] = useState(false);
  const [stripeInvoiceId, setStripeInvoiceId] = useState<string | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [sentInvoiceUrl, setSentInvoiceUrl] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return (
        sum +
        Number(item.quantity || 0) *
          Number(item.unitPrice || 0)
      );
    }, 0);
  }, [items]);

  const expectedAmount =
    invoiceType === "initial_deposit"
      ? initialDeposit
      : invoiceType === "final_balance"
        ? finalCost
        : 0;

  const priorPaid =
    invoiceType === "final_balance"
      ? amountPaidBase
      : 0;

  const estimatedBalance = Math.max(
    0,
    subtotal - priorPaid
  );

  useEffect(() => {
    void loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, invoiceType]);

  async function loadDraft() {
    try {
      setIsLoading(true);

      const res = await fetch(
        `/api/admin/work-orders/${workOrderId}/invoices?type=${invoiceType}`,
        {
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to load invoice draft"
        );
      }

      if (!data.item) {
        setDraftId(null);
        setStripeInvoiceId(null);
        setNotes("");

        if (
          invoiceType === "initial_deposit" &&
          initialDeposit > 0
        ) {
          setItems([
            {
              category: "service",
              description: "Initial Work Order Deposit",
              quantity: 1,
              unitPrice: initialDeposit,
              taxable: false,
            },
          ]);
        } else {
          setItems([newLine()]);
        }

        return;
      }

      setDraftId(data.item.id);
      setStripeInvoiceId(data.item.stripe_invoice_id ?? null);
      setNotes(data.item.notes || "");

      const loadedItems = (data.items || []).map(
        (item: any) => ({
          id: item.id,
          category: item.category,
          description: item.description,
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unit_price ?? 0),
          taxable: Boolean(item.taxable),
          stripeTaxCode:
            item.stripe_tax_code ?? null,
        })
      );

      setItems(
        loadedItems.length
          ? loadedItems
          : [newLine()]
      );
    } catch (error) {
      console.error(error);

      toast({
        title: "Invoice Error",
        description:
          error instanceof Error
            ? error.message
            : "Could not load the invoice draft.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function updateItem(
    index: number,
    changes: Partial<InvoiceItem>
  ) {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, ...changes }
          : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((current) => {
      const next = current.filter(
        (_, i) => i !== index
      );

      return next.length ? next : [newLine()];
    });
  }

  function addItem() {
    setItems((current) => [
      ...current,
      newLine(),
    ]);
  }

  async function saveDraft() {
    const validItems = items.filter(
      (item) =>
        item.description.trim().length > 0 &&
        Number(item.quantity) > 0 &&
        Number(item.unitPrice) >= 0
    );

    if (!validItems.length) {
      toast({
        title: "Invoice Incomplete",
        description:
          "Add at least one invoice line item.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      const res = await fetch(
        `/api/admin/work-orders/${workOrderId}/invoices`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoiceType,
            notes,
            items: validItems,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to save invoice draft"
        );
      }

      setDraftId(data.item.id);

      toast({
        title: "Invoice Draft Saved",
        description:
          "The pricing breakdown has been saved.",
      });

      await loadDraft();
    } catch (error) {
      console.error(error);

      toast({
        title: "Invoice Error",
        description:
          error instanceof Error
            ? error.message
            : "Could not save invoice draft.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-8 pt-8 border-t border-secondary-foreground/20 text-secondary-foreground">
        <p className="font-paragraph text-secondary-foreground/70">
          Loading invoice...
        </p>
      </div>
    );
  }

  async function createStripeDraft() {
    if (!draftId) return;

    try {
      setIsCreatingStripeDraft(true);

      const res = await fetch(
        `/api/admin/work-orders/${workOrderId}/invoices/stripe-draft`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: draftId }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create Stripe draft");
      }

      setStripeInvoiceId(data.stripeInvoiceId);

      toast({
        title: "Stripe Draft Created",
        description:
          `Stripe invoice ${data.stripeInvoiceId} created. ` +
          `Amount due: $${Number(data.amountDue).toFixed(2)}. ` +
          "Nothing has been sent or charged.",
      });
    } catch (error) {
      toast({
        title: "Stripe Invoice Error",
        description:
          error instanceof Error
            ? error.message
            : "Could not create Stripe draft.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStripeDraft(false);
    }
  }

  
async function createAndSendInvoice() {
    if (isSendingInvoice) return;

    const validItems = items.filter(
      (item) =>
        item.description.trim() &&
        Number.isFinite(Number(item.quantity)) &&
        Number(item.quantity) > 0 &&
        Number.isFinite(Number(item.unitPrice)) &&
        Number(item.unitPrice) >= 0
    );

    if (
      validItems.length !== items.length ||
      validItems.length === 0
    ) {
      toast({
        title: "Invalid Invoice",
        description: "Complete every invoice line item.",
        variant: "destructive",
      });
      return;
    }

    if (
      expectedAmount <= 0 ||
      Math.round(subtotal * 100) !== Math.round(expectedAmount * 100)
    ) {
      toast({
        title: "Invoice Total Mismatch",
        description:
          "The itemized subtotal must match the saved work-order cost.",
        variant: "destructive",
      });
      return;
    }

    if (invoiceType === "adjustment" || estimatedBalance <= 0) {
      toast({
        title: "Invoice Cannot Be Sent",
        description: "There is no valid balance to invoice.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSendingInvoice(true);

      let currentInvoiceId = draftId;

      // 1. Save Warwick pricing internally.
      // Reuse a linked Stripe draft instead of trying to modify it.
      if (!stripeInvoiceId) {
        const saveRes = await fetch(
          `/api/admin/work-orders/${workOrderId}/invoices`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceType,
              notes,
              items: validItems,
            }),
          }
        );

        const saveData = await saveRes.json();

        if (!saveRes.ok) {
          throw new Error(saveData?.error || "Saving invoice failed");
        }

        currentInvoiceId = saveData.item.id;
        setDraftId(currentInvoiceId);
      }

      if (!currentInvoiceId) {
        throw new Error("Invoice record is missing");
      }

      // 2. Create or reuse the Stripe draft internally.
      const stripeRes = await fetch(
        `/api/admin/work-orders/${workOrderId}/invoices/stripe-draft`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: currentInvoiceId,
          }),
        }
      );

      const stripeData = await stripeRes.json();

      if (!stripeRes.ok) {
        throw new Error(
          stripeData?.error || "Stripe invoice creation failed"
        );
      }

      setStripeInvoiceId(stripeData.stripeInvoiceId);

      // 3. Finalize and send the live Stripe invoice.
      const sendRes = await fetch(
        `/api/admin/work-orders/${workOrderId}/invoices/send`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: currentInvoiceId,
          }),
        }
      );

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        throw new Error(
          sendData?.error || "Sending invoice failed"
        );
      }

      setSentInvoiceUrl(sendData.hostedInvoiceUrl ?? null);

      toast({
        title: "Invoice Sent",
        description: `Invoice ${sendData.invoiceNumber} was sent successfully.`,
      });

      await loadDraft();
    } catch (error) {
      console.error(error);

      toast({
        title: "Invoice Not Confirmed",
        description:
          error instanceof Error
            ? error.message
            : "Invoice sending failed. Check Stripe before retrying.",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvoice(false);
    }
  }

  return (
    <div className={`${styles.builder} mt-8 pt-8 border-t border-secondary-foreground/20`}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-heading text-2xl text-secondary-foreground">
            Invoice & Pricing Breakdown
          </h3>

          <p className="font-paragraph text-sm text-secondary-foreground/60 mt-1">
            Create an itemized breakdown before sending an invoice to the resident.
          </p>
        </div>

        {draftId && (
          <span className="font-paragraph text-sm text-secondary-foreground/60">
            Draft Saved
          </span>
        )}
      </div>

      <div className="max-w-sm mb-6">
        <Label className="font-paragraph text-sm text-secondary-foreground/70">
          Invoice Type
        </Label>

        <Select
          value={invoiceType}
          onValueChange={(value) =>
            setInvoiceType(
              value as InvoiceType
            )
          }
        >
          <SelectTrigger className="mt-2 bg-secondary text-secondary-foreground border-secondary-foreground/20">
            <SelectValue />
          </SelectTrigger>

          <SelectContent className={styles.menu}>
            <SelectItem value="initial_deposit" >
              Initial Deposit
            </SelectItem>

            <SelectItem value="final_balance" className="bg-secondary text-secondary-foreground">
              Final Balance
            </SelectItem>

            <SelectItem value="adjustment" className="bg-secondary text-secondary-foreground">
              Adjustment
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const lineTotal =
            Number(item.quantity || 0) *
            Number(item.unitPrice || 0);

          return (
            <div
              key={index}
              className="rounded-2xl border border-secondary-foreground/20 p-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-2">
                  <Label className = "mt-2 bg-secondary text-secondary-foreground">Category</Label>

                  <Select
                    value={item.category}
                    onValueChange={(value) =>
                      updateItem(index, {
                        category:
                          value as InvoiceCategory,
                      })
                    }
                  >
                    <SelectTrigger className="mt-2 bg-secondary text-secondary-foreground">
                      <SelectValue className="bg-secondary text-secondary-foreground"/>
                    </SelectTrigger>

                    <SelectContent className={styles.menu}>
                      <SelectItem value="labor" className="bg-secondary text-secondary-foreground">
                        Labor
                      </SelectItem>
                      <SelectItem value="material" className="bg-secondary text-secondary-foreground">
                        Material
                      </SelectItem>
                      <SelectItem value="equipment" className="bg-secondary text-secondary-foreground">
                        Equipment
                      </SelectItem>
                      <SelectItem value="service" className="bg-secondary text-secondary-foreground">
                        Service
                      </SelectItem>
                      <SelectItem value="other" className="bg-secondary text-secondary-foreground">
                        Other
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-4">
                  <Label className="mt-2 bg-secondary text-secondary-foreground">Description</Label>

                  <Input
                    className="mt-2 bg-secondary text-secondary-foreground border-secondary-foreground/20 placeholder:text-secondary-foreground/40"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, {
                        description:
                          e.target.value,
                      })
                    }
                    placeholder="e.g. Plumber labor"
                  />
                </div>

                <div className="lg:col-span-2">
                  <Label className="mt-2 bg-secondary text-secondary-foreground">Quantity</Label>

                  <Input
                    className="mt-2 bg-secondary text-secondary-foreground border-secondary-foreground/20 placeholder:text-secondary-foreground/40"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, {
                        quantity:
                          Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="lg:col-span-2">
                  <Label className = "mt-2 bg-secondary text-secondary-foreground">Unit Price</Label>

                  <Input
                    className="mt-2 bg-secondary text-secondary-foreground border-secondary-foreground/20 placeholder:text-secondary-foreground/40"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(index, {
                        unitPrice:
                          Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="lg:col-span-2">
                  <Label className = "mt-2 bg-secondary text-secondary-foreground">Line Total</Label>

                  <div className="mt-2 h-10 flex items-center font-paragraph text-secondary-foreground">
                    ${lineTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mt-4">
                <label className="flex items-center gap-2 font-paragraph text-sm text-secondary-foreground">
                  <input
                    type="checkbox"
                    checked={item.taxable}
                    onChange={(e) =>
                      updateItem(index, {
                        taxable:
                          e.target.checked,
                      })
                    }
                  />
                  Taxable
                </label>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    removeItem(index)
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addItem}
        className="mt-4"
      >
        + Add Line Item
      </Button>

      <div className="mt-6">
        <Label className="font-paragraph text-sm text-secondary-foreground">Invoice Notes</Label>

        <Textarea
          className="mt-2 bg-secondary text-secondary-foreground border-secondary-foreground/20 placeholder:text-secondary-foreground/40"
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
          placeholder="Optional notes shown with this invoice."
        />
      </div>

      <div className="mt-8 max-w-lg ml-auto space-y-2">
        <div className="flex justify-between">
          <span className="font-paragraph text-secondary-foreground/70">
            Subtotal
          </span>

          <span className="font-paragraph text-secondary-foreground">
            ${subtotal.toFixed(2)}
          </span>
        </div>

        {invoiceType ===
          "final_balance" &&
          priorPaid > 0 && (
            <div className="flex justify-between">
              <span className="font-paragraph text-secondary-foreground/70">
                Previously Paid
              </span>

              <span className="font-paragraph text-secondary-foreground">
                -${priorPaid.toFixed(2)}
              </span>
            </div>
          )}

        <div className="flex justify-between">
          <span className="font-paragraph text-secondary-foreground/70">
            Tax
          </span>

          <span className="font-paragraph text-secondary-foreground/60">
            Calculated when invoice is sent
          </span>
        </div>

        <div className="flex justify-between">
          <span className="font-paragraph text-secondary-foreground/70">
            Card Processing Fee
          </span>

          <span className="font-paragraph text-secondary-foreground/60">
            Calculated when invoice is sent
          </span>
        </div>

        <div className="flex justify-between border-t border-secondary-foreground/20 pt-3">
          <span className="font-heading text-secondary-foreground">
            Balance Before Tax / Fee
          </span>

          <span className="font-heading text-xl text-secondary-foreground">
            ${estimatedBalance.toFixed(2)}
          </span>
        </div>

        {expectedAmount > 0 &&
          Math.abs(subtotal - expectedAmount) >
            0.009 && (
            <p className="font-paragraph text-sm text-destructive mt-3">
              Pricing breakdown subtotal
              (${subtotal.toFixed(2)}) does
              not match the work order{" "}
              {invoiceType ===
              "initial_deposit"
                ? "initial deposit"
                : "final cost"}{" "}
              (${expectedAmount.toFixed(2)}).
            </p>
          )}
      </div>
      
      <div className="flex flex-wrap items-center gap-3 mt-8">
        <Button
          type="button"
          onClick={createAndSendInvoice}
          disabled={isSendingInvoice || Boolean(sentInvoiceUrl)}
          className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90"
        >
          {isSendingInvoice
            ? "Creating & Sending..."
            : sentInvoiceUrl
              ? "Invoice Sent"
              : "Create & Send Invoice"}
        </Button>

        {sentInvoiceUrl && (
          <a
            href={sentInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-paragraph text-sm underline text-secondary-foreground"
          >
            View Invoice
          </a>
        )}
      </div>      
    </div>
  );
}