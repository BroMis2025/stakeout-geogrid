'use client';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useEffect, useState } from 'react';
type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentBalance: number;
  onBalanceUpdated: (n: number) => void;
};
export function CreditTopUpModal(p: Props) {
  const [packs, setPacks] = useState<{ credits: number; cents: number }[]>([]),
    [credits, choose] = useState(500),
    [error, setError] = useState('');
  useEffect(() => {
    if (p.isOpen)
      fetch('/api/paypal/order')
        .then((r) => r.json())
        .then((d) => {
          setPacks(d.packs ?? []);
          choose(d.packs?.[0]?.credits ?? 500);
        })
        .catch(() => setError('Unable to load credit packs.'));
  }, [p.isOpen]);
  if (!p.isOpen) return null;
  async function post(path: string, payload: unknown) {
    const res = await fetch('/api/paypal/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    return d;
  }
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Buy credits"
        className="w-full max-w-md space-y-5 rounded-xl bg-slate-900 p-6"
      >
        <div className="flex justify-between">
          <h2 className="text-lg font-bold">Buy scan credits</h2>
          <button onClick={p.onClose}>Close</button>
        </div>
        <p>Current balance · {p.currentBalance}</p>
        {clientId && packs.length > 0 ? (
          <>
            <select
              aria-label="Credit pack"
              className="w-full rounded bg-slate-800 p-3"
              value={credits}
              onChange={(e) => choose(+e.target.value)}
            >
              {packs.map((k) => (
                <option key={k.credits} value={k.credits}>
                  {k.credits} credits · USD {(k.cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
            <PayPalScriptProvider
              options={{ clientId, currency: 'USD', intent: 'capture' }}
            >
              <PayPalButtons
                forceReRender={[credits]}
                createOrder={async () =>
                  (await post('order', { credits })).orderID
                }
                onApprove={async ({ orderID }) => {
                  const d = await post('capture', { orderID });
                  p.onBalanceUpdated(d.creditBalance);
                  window.dispatchEvent(new Event('balance-change'));
                  p.onClose();
                }}
                onError={() =>
                  setError(
                    'Checkout could not finish. Check your balance before trying again.',
                  )
                }
              />
            </PayPalScriptProvider>
          </>
        ) : (
          <p>Credit packs are awaiting merchant configuration.</p>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
