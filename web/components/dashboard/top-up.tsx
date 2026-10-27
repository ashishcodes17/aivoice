"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: "INR";
  order_id: string;
  name: string;
  description: string;
  theme: { color: string };
  handler: () => void;
  modal: { ondismiss: () => void };
};
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => { open: () => void };
  }
}

const PRESETS = [100, 500, 1000, 5000];

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

export function TopUp({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function pay() {
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, amountRupees: amount }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error ?? "Could not start the payment.");
      await loadCheckout();
      new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: "INR",
        order_id: order.orderId,
        name: "Lynksy",
        description: "Wallet top-up",
        theme: { color: "#262626" },
        handler: () => {
          setDone(true);
          setBusy(false);
          // The webhook credits the wallet; refresh shortly after.
          setTimeout(() => router.refresh(), 2500);
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {done && (
        <Alert variant="success">
          <CheckCircle2Icon />
          <AlertDescription>Payment received. Your balance will update in a moment.</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p} type="button" variant={amount === p ? "default" : "outline"} onClick={() => setAmount(p)}>
            ₹{p.toLocaleString("en-IN")}
          </Button>
        ))}
      </div>
      <Button size="lg" onClick={pay} loading={busy}>
        Add ₹{amount.toLocaleString("en-IN")}
      </Button>
    </div>
  );
}
