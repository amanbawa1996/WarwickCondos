"use client";

import { FormEvent, useState } from "react";
import {
  CardElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

type Props = {
  clientSecret: string;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
};

export default function AddCardForm({
  clientSecret,
  onSaved,
  onCancel,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) return;

    const card = elements.getElement(CardElement);
    if (!card) {
      setErrorMessage("Card form is not ready.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card,
          },
        }
      );

      if (error) {
        setErrorMessage(error.message || "Failed to save card.");
        return;
      }

      if (setupIntent?.status !== "succeeded") {
        setErrorMessage("Card setup did not complete.");
        return;
      }

      await onSaved();
    } catch (err) {
      console.error("confirmCardSetup error:", err);
      setErrorMessage("Failed to save card.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-secondary-foreground/20 p-4 bg-secondary">
        <CardElement
          options={{
            disableLink: true,
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "16px",
                color: "#111827",
                "::placeholder": {
                  color: "#6b7280",
                },
              },
              invalid: {
                color: "#dc2626",
              },
            },
          }}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive font-paragraph">{errorMessage}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!stripe || !elements || isSaving}
          className="flex-1 font-paragraph"
        >
          {isSaving ? "Saving Card..." : "Save Card"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 font-paragraph"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}