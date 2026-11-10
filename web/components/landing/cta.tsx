import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#07061a] px-8 py-20 text-center text-white sm:px-16 sm:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="aurora-a absolute -top-1/2 left-1/4 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.55),transparent_62%)] blur-3xl" />
          <div className="aurora-b absolute -right-20 -bottom-1/2 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(249_115_82/0.35),transparent_62%)] blur-3xl" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute top-1/2 left-1/2 rounded-full border border-white/[0.07]"
              style={{ width: `${30 + i * 18}rem`, height: `${30 + i * 18}rem`, transform: "translate(-50%,-50%)" }}
            />
          ))}
        </div>
        <h2 className="relative mx-auto max-w-3xl text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl">
          Your next call could already be{" "}
          <span className="text-sheen bg-[linear-gradient(90deg,#a5b4fc,#f0abfc,#fdba74,#a5b4fc)] bg-clip-text font-normal font-serif text-transparent italic tracking-normal">
            answered.
          </span>
        </h2>
        <p className="relative mx-auto mt-6 max-w-md text-pretty text-base text-white/60 leading-7">
          Create an account, pick a template and take your first test call today.
        </p>
        <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="xl"
            render={<Link href="/signup" />}
            className="rounded-full border-transparent bg-white px-8 text-[#16162a] shadow-[0_10px_40px_-8px_rgb(129_140_248/0.7)] hover:bg-white/90"
          >
            Get started
            <ArrowRightIcon />
          </Button>
          <Button size="xl" variant="outline" render={<a href="#demo" />} className="rounded-full border-white/15 bg-white/[0.04] px-8 text-white hover:bg-white/[0.09]">
            Hear a call first
          </Button>
        </div>
        <ul className="relative mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/50">
          {["Pay only for minutes used", "Stop any time", "Set up in minutes"].map((t) => (
            <li key={t} className="flex items-center gap-1.5"><CheckIcon className="size-4 text-emerald-400" />{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
