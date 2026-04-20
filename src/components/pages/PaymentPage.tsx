"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ResidentHeader from "@/components/layout/ResidentHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WorkOrder } from "@/types/workorder";
import { SavedCard } from "@/types/savedcard"
import { Elements } from "@stripe/react-stripe-js";
import AddCardForm from "@/components/payments/AddCardForm";
import { stripePromise } from "@/lib/stripe-client";


export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);

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
      setSelectedCardId(data?.item?.selectedPaymentMethodId ?? null);
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

  // async function startCheckout() {
  //   if (!workOrder) return;

  //   try {
  //     setIsRedirecting(true);

  //     const res = await fetch("/api/stripe/checkout", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       credentials: "include",
  //       body: JSON.stringify({ workOrderId: workOrder._id }),
  //     });

  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data?.error || "Checkout failed");

  //     window.location.href = data.url;
  //   } catch (e: any) {
  //     console.error("Checkout error:", e);
  //     toast({
  //       title: "Error",
  //       description: e?.message || "Failed to start checkout.",
  //       variant: "destructive",
  //     });
  //     setIsRedirecting(false);
  //   }
  // }

  async function loadSavedCards() {
    try {
      console.log("Test1")
      const res = await fetch("/api/payments/methods", {
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSavedCards(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load cards", e);
    }
  }

  useEffect(() => {
    loadSavedCards();
  }, []);

  async function startAddCard() {
    try {
      setIsAddingCard(true);

      const res = await fetch("/api/payments/setup-intent", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to initialize card setup");

      setClientSecret(data.clientSecret);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to initialize card setup",
        variant: "destructive",
      });
      setIsAddingCard(false);
    }
  }

  async function handleSelectSavedCard(paymentMethodId: string) {
    if (!workOrder) return;

    try {
      const res = await fetch(`/api/work-orders/${workOrder._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedPaymentMethodId: paymentMethodId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to save selected card");
      }

      setSelectedCardId(paymentMethodId);

      if (data.item) {
        setWorkOrder(data.item);
      } else {
        await loadWorkOrder(workOrder._id);
      }

      toast({
        title: "Saved Card Selected",
        description: "This card is now selected for the work order.",
      });
    } catch (error) {
      console.error("Failed to select saved card:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not save selected card.",
        variant: "destructive",
      });
    }
  }

  async function handleUnselectSavedCard() {
    if (!workOrder) return;

    try {
      const res = await fetch(`/api/work-orders/${workOrder._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedPaymentMethodId: null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to unselect card");
      }

      setSelectedCardId(null);

      if (data.item) {
        setWorkOrder(data.item);
      } else {
        await loadWorkOrder(workOrder._id);
      }

      toast({
        title: "Card Unselected",
        description: "No saved card is currently selected for this work order.",
      });
    } catch (error) {
      console.error("Failed to unselect saved card:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not unselect card.",
        variant: "destructive",
      });
    }
  }


  async function handleCardSaved() {
    setClientSecret(null);
    setIsAddingCard(false);
    await loadSavedCards();

    if (savedCards.length > 0) {
      setSelectedCardId(savedCards[0].id);
    }

    toast({
      title: "Card Saved",
      description: "Your payment method was saved successfully.",
    });
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

  // async function assignSavedCardToWorkOrder() {
  //   if (!workOrder || !selectedCardId) return;

  //   try {
  //     const res = await fetch(`/api/work-orders/${workOrder._id}/payment`, {
  //       method: "PATCH",
  //       credentials: "include",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         paymentMethodId: selectedCardId,
  //       }),
  //     });

  //     const data = await res.json();

  //     if (!res.ok) {
  //       throw new Error(data?.error || "Failed to assign saved card");
  //     }

  //     toast({
  //       title: "Saved Card Selected",
  //       description: "This card is now linked to the work order.",
  //     });

  //     await loadWorkOrder(workOrder._id);
  //   } catch (e: any) {
  //     console.error("Assign saved card error:", e);
  //     toast({
  //       title: "Error",
  //       description: e?.message || "Failed to link saved card.",
  //       variant: "destructive",
  //     });
  //   }
  // }


  return (
    <div className="min-h-screen bg-primary">
      <ResidentHeader />

      <main className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            Payment
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80 mb-12">
            Save or select a card for this work order. Management will only charge the selected card when payment is due.
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
                  <div className="space-y-4">

                    {/* SAVED CARDS */}
                    {/* SAVED CARDS */}
                    {savedCards.length > 0 && (
                      <div className="space-y-3">
                        <p className="font-paragraph text-sm text-secondary-foreground/70">
                          Saved Cards
                        </p>

                        {savedCards.map((card) => {
                          const isSelected =
                            selectedCardId === card.id ||
                            workOrder?.selectedPaymentMethodId === card.id;

                          return (
                            <div
                              key={card.id}
                              className="flex items-center justify-between rounded-md border p-3"
                            >
                              <div>
                                <div className="font-medium">
                                  {card.brand.toUpperCase()} •••• {card.last4}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Expires {card.expMonth}/{card.expYear}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSelectSavedCard(card.id)}
                                className="rounded-md border px-3 py-1 text-sm"
                                disabled={isSelected}
                              >
                                {isSelected ? "Selected" : "Use this card"}
                              </button>
                            </div>
                          );
                        })}

                        {workOrder?.selectedPaymentMethod && (
                          <div className="rounded-md border p-3">
                            <p className="font-paragraph text-sm text-secondary-foreground/70">
                              Selected for this work order
                            </p>
                            <p className="font-medium text-secondary-foreground mt-1">
                              {workOrder.selectedPaymentMethod.brand.toUpperCase()} ••••{" "}
                              {workOrder.selectedPaymentMethod.last4}
                              {workOrder.selectedPaymentMethod.expMonth &&
                              workOrder.selectedPaymentMethod.expYear
                                ? ` (${workOrder.selectedPaymentMethod.expMonth}/${workOrder.selectedPaymentMethod.expYear})`
                                : ""}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {workOrder?.selectedPaymentMethod && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleUnselectSavedCard}
                        className="w-full font-paragraph"
                      >
                        Unselect Card
                      </Button>
                    )}

                    {/* ADD CARD */}
                    <Button
                      onClick={startAddCard}
                      disabled={isAddingCard}
                      className="w-full font-paragraph"
                    >
                      {isAddingCard ? "Loading Card Form..." : "+ Add New Card"}
                    </Button>

                    {/* STRIPE ELEMENTS WILL GO HERE */}
                    {clientSecret && (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: "stripe",
                          },
                          loader: "auto"
                        }}
                      >
                        <AddCardForm
                          clientSecret={clientSecret}
                          onSaved={handleCardSaved}
                          onCancel={() => {
                            setClientSecret(null);
                            setIsAddingCard(false);
                          }}
                        />
                      </Elements>
                    )}

                    {/* PAY WITH SAVED CARD
                    <Button
                      onClick={assignSavedCardToWorkOrder}
                      disabled={!selectedCardId || isAddingCard || alreadyPaid}
                    >
                      Pay with Saved Card
                    </Button> */}

                    {/* EXISTING CHECKOUT (KEEP THIS)
                    <Button
                      onClick={startCheckout}
                      disabled={alreadyPaid || amountDue <= 0 || isRedirecting}
                      className="w-full font-paragraph"
                    >
                      Pay with Stripe Checkout
                    </Button> */}

                  </div>

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