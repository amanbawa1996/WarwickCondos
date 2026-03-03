import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import './StripePaymentForm.css';

interface StripePaymentFormProps {
  amount: number;
  workOrderId: string;
  onSuccess: () => void;
  isProcessing: boolean;
}

export default function StripePaymentForm({
  amount,
  workOrderId,
  onSuccess,
  isProcessing,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [cardError, setCardError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCardChange = (event: any) => {
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setCardError('Stripe is not loaded');
      return;
    }

    setIsLoading(true);

    try {
      // Create payment intent on backend
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          workOrderId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      // Confirm payment with Stripe
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            // Add billing details if needed
          },
        },
      });

      if (result.error) {
        setCardError(result.error.message || 'Payment failed');
        toast({
          title: 'Payment Failed',
          description: result.error.message || 'An error occurred during payment',
          variant: 'destructive',
        });
      } else if (result.paymentIntent?.status === 'succeeded') {
        toast({
          title: 'Payment Successful',
          description: 'Your payment has been processed successfully.',
        });
        onSuccess();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setCardError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-secondary rounded-lg p-6 border border-secondary-foreground/10">
        <label className="font-paragraph text-sm text-secondary-foreground/80 block mb-3">
          Card Details
        </label>
        <CardElement
          onChange={handleCardChange}
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#000000',
                '::placeholder': {
                  color: '#999999',
                },
              },
              invalid: {
                color: '#DF3131',
              },
            },
          }}
        />
      </div>

      {cardError && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="font-paragraph text-sm text-destructive">{cardError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isLoading || isProcessing}
        className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
      >
        {isLoading || isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </Button>
    </form>
  );
}
