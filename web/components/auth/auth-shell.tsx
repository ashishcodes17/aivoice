import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { LogoMark } from "@/components/landing/logo";

const points = [
  "Speak Hindi, Tamil, Telugu and more",
  "Answer calls on Indian phone numbers",
  "Pay per minute, in rupees",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="font-heading font-semibold text-[15px] tracking-tight">Lynksy</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-end lg:p-14">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(80%_70%_at_30%_20%,black,transparent)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_20%_0%,rgb(255_255_255/0.16),transparent)]"
        />
        <div className="relative max-w-md">
          <h2 className="text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em]">
            Put your first agent on the{" "}
            <span className="font-normal font-serif italic tracking-normal">phone</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-primary-foreground/80 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/12">
                  <CheckIcon className="size-3" strokeWidth={2.5} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
