"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ResidentHeader from "@/components/layout/ResidentHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WorkOrder } from "@/types/workorder";

// Minimal shape needed for this page (matches your /api/work-orders/[id] mapper)
// type WorkOrder = {
//   _id: string;
//   title: string;
//   description: string;
//   category?: string;
//   unitNumber: string;

//   paymentStatus?: string;
//   paymentRequestAmount?: number;
//   actualCost?: number;
//   estimatedCost?: number;
// };

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) {
      setIsLoading(false);
      return;
    }
    void loadWorkOrder(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadWorkOrder(id: string) {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/work-orders/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load work order");
      setWorkOrder(data.item);
    } catch (e: any) {
      console.error("Error loading work order:", e);
      toast({
        title: "Error",
        description: "Failed to load work order details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }


  // Amount due — mirror server logic (server remains source of truth)
  function getAmountDue(order: WorkOrder | null): number {
    if (!order) return 0;
    return Number(order.paymentRequestAmount ?? order.actualCost ?? order.estimatedCost ?? 0);
  }

  async function startCheckout() {
    if (!workOrder) return;

    try {
      setIsRedirecting(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workOrderId: workOrder._id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed");

      window.location.href = data.url;
    } catch (e: any) {
      console.error("Checkout error:", e);
      toast({
        title: "Error",
        description: e?.message || "Failed to start checkout.",
        variant: "destructive",
      });
      setIsRedirecting(false);
    }
  }

  const amountDue = getAmountDue(workOrder);
  const alreadyPaid = (workOrder?.paymentStatus || "unpaid").toLowerCase() === "paid";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary">
        <ResidentHeader />
        <div className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
          <div className="text-center">
            <p className="font-paragraph text-xl text-primary-foreground/80 mb-8">
              Loading payment details...
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-primary">
        <ResidentHeader />
        <div className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
          <div className="text-center">
            <p className="font-paragraph text-xl text-primary-foreground/80 mb-8">
              No work order selected for payment
            </p>
            <Button
              onClick={() => navigate("/Dashboard")}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-paragraph"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-primary">
      <ResidentHeader />

      <main className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            Payment
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80 mb-12">
            You’ll be redirected to Stripe Checkout to complete payment.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Action */}
            <div className="space-y-6">
              <div className="bg-secondary rounded-3xl p-6 lg:p-8">
                <h2 className="font-heading text-2xl text-secondary-foreground mb-6">
                  Payment Details
                </h2>

                <div className="flex items-center justify-between py-4 border-b border-secondary-foreground/10">
                  <span className="font-paragraph text-secondary-foreground/70">Total</span>
                  <span className="font-heading text-2xl text-secondary-foreground">
                    ${amountDue.toFixed(2)}
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={startCheckout}
                    disabled={alreadyPaid || amountDue <= 0 || isRedirecting}
                    className="w-full font-paragraph"
                  >
                    {alreadyPaid
                      ? "Already Paid"
                      : isRedirecting
                      ? "Redirecting..."
                      : "Pay with Stripe"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate(`/work-order/${workOrder._id}`)}
                    className="w-full font-paragraph"
                  >
                    Back to Work Order
                  </Button>

                  <p className="font-paragraph text-sm text-secondary-foreground/60">
                    Payment status is updated automatically after Stripe confirms payment.
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-secondary rounded-3xl p-8 lg:p-10">
              <h2 className="font-heading text-2xl text-secondary-foreground mb-8">
                Order Summary
              </h2>

              <div className="space-y-6">
                <div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60">Work Order</p>
                  <p className="font-paragraph text-lg text-secondary-foreground mt-1">
                    {workOrder.title}
                  </p>
                </div>

                <div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60">Unit Number</p>
                  <p className="font-paragraph text-base text-secondary-foreground mt-1">
                    {workOrder.unitNumber}
                  </p>
                </div>

                <div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60">Category</p>
                  <p className="font-paragraph text-base text-secondary-foreground mt-1">
                    {workOrder.category}
                  </p>
                </div>

                <div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60">Description</p>
                  <p className="font-paragraph text-base text-secondary-foreground mt-1">
                    {workOrder.description}
                  </p>
                </div>

                <div className="pt-6 border-t border-secondary-foreground/20">
                  <div className="flex justify-between items-center pt-4">
                    <span className="font-heading text-2xl text-secondary-foreground">Total</span>
                    <span className="font-heading text-3xl text-secondary-foreground">
                      ${amountDue.toFixed(2)}
                    </span>
                  </div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60 mt-3">
                    Payment is processed securely via Stripe Checkout.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}