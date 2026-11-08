import { CheckCircle2Icon, FileTextIcon, LanguagesIcon, ZapIcon } from "lucide-react";

const bars = [18, 34, 52, 28, 64, 80, 46, 70, 38, 88, 56, 74, 42, 90, 60, 32, 68, 48, 84, 40, 72, 54, 30, 62, 22, 50, 78, 36, 58, 26, 44, 66, 30, 52, 20];

const lines: { who: "agent" | "caller"; text: string }[] = [
  { who: "agent", text: "नमस्ते! Sunrise Dental में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?" },
  { who: "caller", text: "Mujhe kal shaam ka appointment chahiye." },
  { who: "agent", text: "ज़रूर। कल शाम पाँच बजे के आसपास ठीक रहेगा? मैं team से confirm करवा देती हूँ।" },
  { who: "caller", text: "Haan, paanch baje perfect hai." },
];

function Chip({ icon: Icon, label, value, className, delay }: { icon: typeof ZapIcon; label: string; value: string; className: string; delay: string }) {
  return (
    <div
      className={"float-y absolute z-10 hidden items-center gap-3 rounded-2xl border border-[#16162a]/8 bg-white/90 px-3.5 py-2.5 shadow-[0_12px_30px_-12px_rgb(22_22_42/0.25)] backdrop-blur-xl xl:flex " + className}
      style={{ animationDelay: delay }}
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-indigo-50">
        <Icon className="size-4 text-indigo-600" />
      </span>
      <span className="leading-tight">
        <span className="block text-[#7a7a92] text-[11px]">{label}</span>
        <span className="block font-medium text-[#16162a] text-sm">{value}</span>
      </span>
    </div>
  );
}

/** Illustrative product mock; not a real call. */
export function CallCard() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgb(99_102_241/0.18),transparent)] blur-2xl" />

      <Chip icon={LanguagesIcon} label="Caller speaks" value="Hinglish" className="top-24 -left-[13.5rem]" delay="0s" />
      <Chip icon={ZapIcon} label="Reply" value="Streamed as it thinks" className="top-48 -right-[15rem]" delay="-2s" />
      <Chip icon={CheckCircle2Icon} label="Outcome" value="Visit requested" className="bottom-20 -left-[12.5rem]" delay="-4s" />
      <Chip icon={FileTextIcon} label="After the call" value="Transcript saved" className="-right-[13rem] bottom-8" delay="-3s" />

      <div className="overflow-hidden rounded-3xl border border-[#16162a]/8 bg-white shadow-[0_40px_100px_-40px_rgb(60_50_140/0.35)] ring-1 ring-black/[0.02]">
        <div className="flex items-center justify-between border-[#16162a]/[0.07] border-b px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-[#16162a] text-sm">Live call</span>
            <span className="hidden text-[#7a7a92] text-sm sm:inline">Inbound · +91 98•••• ••246</span>
          </div>
          <span className="rounded-full bg-[#16162a]/[0.05] px-2.5 py-0.5 font-mono text-[#55556d] text-xs tabular-nums">00:42</span>
        </div>

        <div className="flex h-20 items-center justify-center gap-[3px] border-[#16162a]/[0.07] border-b px-5" aria-hidden>
          {bars.map((h, i) => (
            <span
              key={i}
              className="wave-bar w-[3px] rounded-full bg-gradient-to-t from-indigo-500 via-fuchsia-500 to-orange-400"
              style={{ height: `${h}%`, animationDelay: `${(i % 9) * 0.11}s`, opacity: 0.35 + (h / 90) * 0.65 }}
            />
          ))}
        </div>

        <div className="min-h-[19rem] space-y-4 px-5 py-6">
          {lines.map((l, i) => (
            <div key={i} className={"line-in " + (l.who === "caller" ? "flex justify-end" : "flex")} style={{ animationDelay: `${i * 1.6}s` }}>
              <div className="max-w-[85%]">
                <p className={"mb-1.5 font-medium text-[#8a8aa2] text-[10px] uppercase tracking-[0.14em] " + (l.who === "caller" ? "text-right" : "")}>
                  {l.who === "agent" ? "Agent · Meera" : "Caller"}
                </p>
                <p
                  className={
                    "rounded-2xl px-4 py-2.5 text-sm leading-6 " +
                    (l.who === "agent"
                      ? "rounded-tl-md border border-[#16162a]/[0.07] bg-[#f5f4fb] text-[#1f1f38]"
                      : "rounded-tr-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_8px_24px_-10px_rgb(99_102_241/0.6)]")
                  }
                >
                  {l.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-[#16162a]/[0.07] border-t bg-[#faf9fd] px-5 py-3 text-xs">
          <span className="rounded-full border border-[#16162a]/10 bg-white px-2.5 py-0.5 text-[#55556d]">Hindi + English</span>
          <span className="rounded-full border border-[#16162a]/10 bg-white px-2.5 py-0.5 text-[#55556d]">Transcribed live</span>
          <span className="ml-auto text-[#8a8aa2]">Illustrative example</span>
        </div>
      </div>
    </div>
  );
}
