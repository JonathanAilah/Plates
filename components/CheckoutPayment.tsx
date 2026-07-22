'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// The inner form — has access to the Stripe context via hooks.
function PaymentForm({
  clientSecrets,
  totalLabel,
  onSuccess,
  onCancel,
}: {
  clientSecrets: string[];
  totalLabel: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    // Validate the entered card details first.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Please check your card details.');
      setProcessing(false);
      return;
    }

    // Confirm each PaymentIntent in sequence (one per cook).
    for (let i = 0; i < clientSecrets.length; i++) {
      const secret = clientSecrets[i];
      const isFirst = i === 0;
      const { error: confirmError } = await stripe.confirmPayment({
        elements: isFirst ? elements : undefined,
        clientSecret: secret,
        confirmParams: {},
        redirect: 'if_required',
      });
      if (confirmError) {
        setError(confirmError.message || 'Payment failed. Please try again.');
        setProcessing(false);
        return;
      }
    }

    // All charges succeeded.
    onSuccess();
  };

  return (
    <div>
      <PaymentElement />
      {error && (
        <div style={{ marginTop: 12, padding: 10, background: '#fceded', border: '1px solid #f5b8b8', borderRadius: 10, color: '#8a2a2a', fontSize: 13 }}>
          {error}
        </div>
      )}
      <button
        onClick={handlePay}
        disabled={!stripe || processing}
        style={{ width: '100%', marginTop: 16, padding: 14, background: '#c96342', color: '#fff', border: 'none', borderRadius: 13, fontWeight: 500, fontSize: 14, cursor: processing ? 'default' : 'pointer', opacity: processing ? 0.6 : 1 }}
      >
        {processing ? 'Processing…' : `Pay ${totalLabel}`}
      </button>
      <button
        onClick={onCancel}
        disabled={processing}
        style={{ width: '100%', marginTop: 8, padding: 12, background: 'transparent', border: 'none', color: '#7a6f5f', fontSize: 13, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}

// Wrapper that sets up the Elements provider.
export default function CheckoutPayment({
  clientSecrets,
  totalLabel,
  onSuccess,
  onCancel,
}: {
  clientSecrets: string[];
  totalLabel: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  if (clientSecrets.length === 0) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: clientSecrets[0], appearance: { theme: 'stripe' } }}
    >
      <PaymentForm
        clientSecrets={clientSecrets}
        totalLabel={totalLabel}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}