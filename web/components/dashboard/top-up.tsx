"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, LockIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const PRESETS = [500, 1000, 2500, 5000, 10000];
const MIN = 100;
const MAX = 100000;

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

export function TopUp({ orgId, balancePaise = 0 }: { orgId: string; balancePaise?: number }) {
  const router = useRouter();
  // When overdrawn, suggest enough to clear what is owed and keep a little spare (rounded up to a whole Rs 100).
  const owed = Math.max(0, -balancePaise) / 100;
  const suggested = owed > 0 ? Math.min(MAX, Math.max(MIN, Math.ceil((owed + 100) / 100) * 100)) : null;
  const presets = suggested && !PRESETS.includes(suggested) ? [suggested, ...PRESETS.slice(0, 4)] : PRESETS;
  const [amount, setAmount] = useState(suggested ?? 500);
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

  const valid = Number.isInteger(amount) && amount >= MIN && amount <= MAX;
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
      <div role="radiogroup" aria-label="Amount" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={amount === p}
            onClick={() => setAmount(p)}
            className={cn(
              "cursor-pointer rounded-xl border px-3 py-3 text-center font-heading font-semibold text-base tabular-nums transition-all",
              amount === p ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            {p === suggested && <span className="mb-0.5 block font-body font-medium text-[10px] text-primary uppercase tracking-wide">Suggested</span>}
            ₹{p.toLocaleString("en-IN")}
          </button>
        ))}
        <label className={cn("flex items-center gap-1 rounded-xl border px-3 transition-all focus-within:ring-2 focus-within:ring-primary/20", !presets.includes(amount) && "border-primary bg-primary/10")}>
          <span className="text-muted-foreground">₹</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            step={1}
            placeholder="Other"
            aria-label="Other amount in rupees"
            value={presets.includes(amount) ? "" : amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="h-11 w-full min-w-0 bg-transparent font-heading font-semibold text-base tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        </label>
      </div>
      {!valid && <p className="text-destructive-foreground text-sm">Enter a whole amount between ₹{MIN.toLocaleString("en-IN")} and ₹{MAX.toLocaleString("en-IN")}.</p>}
      {valid && (
        <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Balance after paying</span>
          <span className={cn("font-medium tabular-nums", balancePaise / 100 + amount < 0 && "text-destructive-foreground")}>
            {(balancePaise / 100 + amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
          </span>
        </div>
      )}
      <Button size="lg" className="w-full" onClick={pay} loading={busy} disabled={!valid}>
        <LockIcon /> Add ₹{valid ? amount.toLocaleString("en-IN") : "—"}
      </Button>
      <p className="text-center text-muted-foreground text-xs">Secure payment by Razorpay. UPI, cards and net banking.</p>
    </div>
  );
}
