import type { Metadata } from "next";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { Accent } from "@/components/landing/section";
import { BillingExamples } from "@/components/pricing/billing-examples";
import { Estimator } from "@/components/pricing/estimator";
import { InsideTheMinute } from "@/components/pricing/inside-the-minute";
import { PlanCard } from "@/components/pricing/plan-card";
import { PricingFaq } from "@/components/pricing/pricing-faq";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple pay-per-minute pricing in rupees for AI voice agents that answer and make phone calls in Indian languages.",
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(70%_70%_at_50%_0%,black,transparent)]"
          />
          <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">Pricing</p>
              <h1 className="mt-5 text-balance font-heading font-semibold text-[2.6rem] leading-[1.04] tracking-[-0.045em] sm:text-6xl sm:leading-[1.02] lg:text-7xl">
                Pay for the <Accent>minutes</Accent> you use.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground leading-8">
                One simple price per minute, in rupees. No plans to compare and nothing to configure.
              </p>
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
              <PlanCard />
              <Estimator />
            </div>
          </div>
        </section>

        <InsideTheMinute />
        <BillingExamples />
        <PricingFaq />
        <div className="pt-4">
          <Cta />
        </div>
      </main>
      <Footer />
    </>
  );
}
