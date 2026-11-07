import { Cta } from "@/components/landing/cta";
import { Demo } from "@/components/landing/demo";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { Pillars } from "@/components/landing/pillars";
import { Savings } from "@/components/landing/savings";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Languages } from "@/components/landing/languages";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <Demo />
        <Pillars />
        <Savings />
        <Features />
        <Languages />
        <HowItWorks />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
