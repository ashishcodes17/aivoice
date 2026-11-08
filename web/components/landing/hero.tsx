import Link from "next/link";
import { ArrowRightIcon, CheckIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallCard } from "./call-card";

const TRUST = ["11 Indian languages", "Billed per minute in ₹", "No code to write"];

export function Hero() {
  return (
    <section className="relative -mt-[68px] overflow-hidden bg-[#fbfaff] pt-[68px] text-[#16162a]">
      {/* Soft light wash, never darker than the page below it */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora-a absolute -top-[30%] left-[4%] size-[44rem] rounded-full bg-[radial-gradient(circle,rgb(129_140_248/0.28),transparent_62%)] blur-3xl" />
        <div className="aurora-b absolute top-[-5%] right-[-8%] size-[38rem] rounded-full bg-[radial-gradient(circle,rgb(244_114_182/0.20),transparent_62%)] blur-3xl" />
        <div className="aurora-a absolute top-[40%] left-[40%] size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(251_191_136/0.22),transparent_62%)] blur-3xl [animation-delay:-7s]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(22_22_42/0.10)_1px,transparent_1px)] bg-[size:26px_26px] [mask-image:radial-gradient(65%_55%_at_50%_28%,black,transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 rounded-full border border-[#16162a]/10 bg-white py-1 pr-3 pl-1 text-[#3a3a55] text-sm shadow-[0_2px_10px_-4px_rgb(22_22_42/0.15)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgb(22_22_42/0.25)]"
          >
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-2 py-0.5 font-medium text-white text-xs">
              <SparklesIcon className="size-3" /> New
            </span>
            Hear a real agent on a call
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>

          <h1 className="mt-8 text-balance font-heading font-semibold text-[2.75rem] leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[5rem]">
            Phone agents that speak{" "}
            <span className="text-sheen bg-[linear-gradient(90deg,#4f46e5,#c026d3,#ea580c,#4f46e5)] bg-clip-text pr-1 font-normal font-serif text-transparent italic tracking-[-0.02em]">
              every Indian language.
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-[#55556d] text-lg leading-8">
            Answer and place calls on Indian numbers in Hindi, Tamil, Telugu, Hinglish and more. Your agent picks up on
            the first ring, every time, and you pay only for the minutes it talks.
          </p>

          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
            <Button
              size="xl"
              className="w-full rounded-full border-transparent bg-[#16162a] px-7 text-white shadow-[0_10px_30px_-10px_rgb(22_22_42/0.6)] hover:bg-[#16162a]/90 sm:w-auto"
              render={<Link href="/signup" />}
            >
              Start building
              <ArrowRightIcon />
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="w-full rounded-full border-[#16162a]/12 bg-white px-7 text-[#16162a] shadow-none hover:bg-white/70 sm:w-auto"
              render={<a href="#demo" />}
            >
              <PlayIcon className="fill-current" />
              Listen to a call
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[#55556d] text-sm">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon className="size-4 text-emerald-600" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-16 sm:mt-20">
          <CallCard />
        </div>
      </div>
    </section>
  );
}
