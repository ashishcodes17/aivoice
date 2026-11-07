import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="px-6 pb-24 sm:pb-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16 sm:py-24">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_0%,rgb(235_104_52/0.55),transparent),radial-gradient(70%_70%_at_10%_100%,rgb(255_255_255/0.14),transparent)]"
        />
        <h2 className="relative mx-auto max-w-2xl text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          Put your first agent on the <span className="font-normal font-serif italic tracking-normal">phone</span>.
        </h2>
        <p className="relative mx-auto mt-5 max-w-md text-pretty text-base text-primary-foreground/75 leading-7">
          Create an account, write a prompt and take your first call today.
        </p>
        <div className="relative mt-10">
          <Button
            size="xl"
            render={<Link href="/signup" />}
            className="border-transparent bg-white text-indigo-700 shadow-none hover:bg-white/90"
          >
            Get started
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </section>
  );
}
