import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accent } from "./section";

export function Cta() {
  return (
    <section className="px-6 pb-24 sm:pb-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16 sm:py-24">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(255_255_255/0.14),transparent)]"
        />
        <h2 className="relative mx-auto max-w-2xl text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          Put your first agent on the <Accent>phone</Accent>.
        </h2>
        <p className="relative mx-auto mt-5 max-w-md text-pretty text-base text-primary-foreground/70 leading-7">
          Create an account, write a prompt and take your first call today.
        </p>
        <div className="relative mt-10">
          <Button
            size="xl"
            render={<Link href="/signup" />}
            className="border-transparent bg-background text-foreground shadow-none hover:bg-background/90"
          >
            Get started
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </section>
  );
}
