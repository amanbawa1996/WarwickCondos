import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {useMember } from '@/integrations';
// import { WorkOrder } from '@/types/workorder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ResidentHeader from '@/components/layout/ResidentHeader';
import Footer from '@/components/layout/Footer';
import { Elements } from "@stripe/react-stripe-js";
import AddCardForm from "@/components/payments/AddCardForm";
import { stripePromise } from "@/lib/stripe-client";
import { SavedCard } from "@/types/savedcard";


export default function SubmitRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useMember();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [paymentAuthorizationAccepted, setPaymentAuthorizationAccepted] =
    useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    // category: "",
    unitNumber: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
  });
  // Auto-populate resident's email and name from authenticated session
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return;

        const data = await res.json();

        // Make this tolerant to whatever your /api/profile returns
        const unit = data?.profile?.unit_number ?? data?.unit_number ?? "";
        const name =
          data?.profile?.full_name ??
          [data?.profile?.first_name, data?.profile?.last_name].filter(Boolean).join(" ").trim() ??
          "";
        const email = data?.profile?.email ?? "";
        const phone = data?.profile?.phone_number ?? "";

        setFormData((prev) => ({
          ...prev,
          unitNumber: prev.unitNumber || unit,
          ownerName: prev.ownerName || name,
          ownerEmail: prev.ownerEmail || email,
          ownerPhone: prev.ownerPhone || phone,
        }));
      } catch {
        // ignore
      }
    })();
  }, []);

  async function loadSavedCards(): Promise<SavedCard[]> {
    try {
      const res = await fetch("/api/payments/methods", {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load saved cards");
      }

      const items = (data.items || []) as SavedCard[];
      setSavedCards(items);
      return items;
    } catch (error) {
      console.error("Failed to load saved cards:", error);
      setSavedCards([]);
      return [];
    }
  }

  async function startAddCard() {
    try {
      setIsAddingCard(true);

      const res = await fetch("/api/payments/setup-intent", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to initialize card setup");
      }

      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "Failed to initialize the card form.",
        variant: "destructive",
      });

      setIsAddingCard(false);
    }
  }

  async function handleCardSaved(paymentMethodId: string) {
    setClientSecret(null);
    setIsAddingCard(false);
    setSelectedCardId(paymentMethodId);

    await loadSavedCards();

    toast({
      title: "Card Saved",
      description: "The new card is selected for this work order.",
    });
  }

  useEffect(() => {
    void loadSavedCards();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    setIsSubmitting(true);

    try {
      if (!isAuthenticated) {
        throw new Error("You are not logged in. Please login again.");
      }

      if (!selectedCardId) {
        throw new Error("Select or add a card before submitting the work order.");
      }

      if (!paymentAuthorizationAccepted) {
        throw new Error("Please accept the payment authorization.");
      }

      const res = await fetch("/api/resident/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          selectedPaymentMethodId: selectedCardId,
          paymentAuthorizationAccepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create work order");
      }

      toast({
        title: "Request Submitted",
        description: "Your work order request has been submitted successfully.",
      });

      navigate("/ResidentHomePage");
    } catch (error) {
      console.error("Error submitting work order:", error);

      toast({
        title: "Submission Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit your work order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      <ResidentHeader />

      <main className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            Submit Work Order
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80 mb-12">
            Complete the form below to submit your maintenance or service request
          </p>

          <form onSubmit={handleSubmit} className="bg-secondary rounded-3xl p-8 lg:p-12 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-paragraph text-base text-secondary-foreground">
                  Request Title *
                </Label>
                <Input
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="e.g., Leaking faucet in kitchen"
                />
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-paragraph text-base text-secondary-foreground">
                Description *
              </Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-secondary border-secondary-foreground/20 text-secondary-foreground min-h-32"
                placeholder="Provide detailed information about the issue..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="priority" className="font-paragraph text-base text-secondary-foreground">
                  Priority *
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitNumber" className="font-paragraph text-base text-secondary-foreground">
                  Unit Number *
                </Label>
                <Input
                  id="unitNumber"
                  required
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="e.g., 301"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="ownerName" className="font-paragraph text-base text-secondary-foreground">
                  Your Name *
                </Label>
                <Input
                  id="ownerName"
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerEmail" className="font-paragraph text-base text-secondary-foreground">
                  Email Address *
                </Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  required
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerPhone" className="font-paragraph text-base text-secondary-foreground">
                Phone Number *
              </Label>
              <Input
                id="ownerPhone"
                type="tel"
                required
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-5 border-t border-secondary-foreground/20 pt-8">
              <div>
                <h2 className="font-heading text-2xl text-secondary-foreground">
                  Payment Method *
                </h2>
                <p className="font-paragraph text-sm text-secondary-foreground/70 mt-2">
                  Select or add the card that Warwick Condos may use for the initial
                  deposit and final balance for this work order.
                </p>
              </div>

              {savedCards.length > 0 && (
                <div className="space-y-3">
                  {savedCards.map((card) => {
                    const isSelected = selectedCardId === card.id;

                    return (
                      <div
                        key={card.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-secondary-foreground/20 p-4"
                      >
                        <div>
                          <p className="font-paragraph font-medium text-secondary-foreground">
                            {card.brand.toUpperCase()} •••• {card.last4}
                          </p>
                          <p className="font-paragraph text-sm text-secondary-foreground/60">
                            Expires {card.expMonth}/{card.expYear}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                        >
                          {isSelected ? "Unselect" : "Use This Card"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {savedCards.length === 0 && !clientSecret && (
                <p className="font-paragraph text-sm text-secondary-foreground/70">
                  You do not have a saved card yet. Add one before submitting.
                </p>
              )}

              <Button
                type="button"
                onClick={startAddCard}
                disabled={isAddingCard}
                className="font-paragraph"
              >
                {isAddingCard ? "Loading Card Form..." : "+ Add New Card"}
              </Button>

              {clientSecret && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: "stripe",
                    },
                    loader: "auto",
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

              <label className="flex items-start gap-3 rounded-2xl border border-secondary-foreground/20 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentAuthorizationAccepted}
                  onChange={(e) =>
                    setPaymentAuthorizationAccepted(e.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />

                <span className="font-paragraph text-sm text-secondary-foreground">
                  I authorize Warwick Condos to save and charge the selected card for
                  the initial deposit and final balance associated with this work order.
                  A receipt will be emailed after each successful charge.
                </span>
              </label>
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting || !selectedCardId || !paymentAuthorizationAccepted}
                className="flex-1 bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/ResidentHomePage')}
                className="border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground hover:text-secondary font-paragraph text-lg py-6"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
