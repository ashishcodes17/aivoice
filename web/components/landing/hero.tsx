import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accent } from "./section";
import { CallCard } from "./call-card";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="outline" size="lg" className="gap-2 rounded-full px-3">
            <span className="size-1.5 rounded-full bg-success" />
            Voice agents for India
          </Badge>
          <h1 className="mt-8 text-balance font-heading font-semibold text-[2.6rem] leading-[1.04] tracking-[-0.045em] sm:text-6xl sm:leading-[1.02] lg:text-7xl">
            Phone agents that speak <Accent>every</Accent> Indian language.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground leading-8">
            Build voice agents that answer and place calls on Indian numbers, in the language your
            callers actually speak. Pay per minute, in rupees.
          </p>
          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
            <Button size="xl" className="w-full sm:w-auto" render={<Link href="/signup" />}>
              Start building
              <ArrowRightIcon />
            </Button>
            <Button size="xl" variant="outline" className="w-full sm:w-auto" render={<a href="#how" />}>
              See how it works
            </Button>
          </div>
        </div>
        <div className="mt-16 sm:mt-20">
          <CallCard />
        </div>
      </div>
    </section>
  );
}
