import { Badge } from "@/components/ui/badge";

const bars = [18, 34, 52, 28, 64, 80, 46, 70, 38, 88, 56, 74, 42, 90, 60, 32, 68, 48, 84, 40, 72, 54, 30, 62, 22, 50, 78, 36, 58, 26];

const lines: { who: "agent" | "caller"; text: string }[] = [
  { who: "agent", text: "नमस्ते! Sunrise Dental में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?" },
  { who: "caller", text: "Mujhe kal shaam ka appointment chahiye." },
  { who: "agent", text: "ज़रूर। कल शाम 5 बजे का slot खाली है। क्या मैं book कर दूँ?" },
];

/** Illustrative product mock; not a real call. */
export function CallCard() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div
        aria-hidden
        className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/[0.10] to-transparent blur-2xl"
      />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-black/[0.06] shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <span className="font-medium text-sm">Live call</span>
            <span className="hidden text-muted-foreground text-sm sm:inline">
              Inbound · +91 98•••• ••246
            </span>
          </div>
          <span className="font-mono text-muted-foreground text-xs tabular-nums">00:42</span>
        </div>

        <div className="flex h-16 items-center justify-center gap-[3px] border-b px-5" aria-hidden>
          {bars.map((h, i) => (
            <span
              key={i}
              className="wave-bar w-[3px] rounded-full bg-primary/70"
              style={{ height: `${h}%`, animationDelay: `${(i % 9) * 0.11}s` }}
            />
          ))}
        </div>

        <div className="space-y-4 px-5 py-5">
          {lines.map((l, i) => (
            <div key={i} className={l.who === "caller" ? "flex justify-end" : "flex"}>
              <div className="max-w-[88%]">
                <p
                  className={
                    "mb-1.5 font-medium text-[11px] uppercase tracking-[0.12em] " +
                    (l.who === "caller" ? "text-right text-muted-foreground" : "text-muted-foreground")
                  }
                >
                  {l.who === "agent" ? "Agent" : "Caller"}
                </p>
                <p
                  className={
                    "rounded-2xl px-4 py-2.5 text-sm leading-6 " +
                    (l.who === "agent"
                      ? "rounded-tl-md bg-muted text-foreground"
                      : "rounded-tr-md bg-primary text-primary-foreground")
                  }
                >
                  {l.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-3">
          <Badge variant="outline">Hindi</Badge>
          <Badge variant="outline">Transcribed live</Badge>
          <span className="ml-auto text-muted-foreground text-xs">Illustrative example</span>
        </div>
      </div>
    </div>
  );
}
