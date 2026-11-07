import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Section, SectionHeading } from "./section";

// Four illustrated cards: what makes a Lynksy agent feel like a person on the phone.
// Every claim here maps to something the voice worker does; there are no invented benchmarks.

const DOTS =
  "bg-[radial-gradient(circle,color-mix(in_srgb,var(--foreground)_14%,transparent)_1px,transparent_1.2px)] bg-[size:14px_14px]";

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] text-primary uppercase tracking-wider">{children}</span>;
}

function Pillar({
  n,
  tag,
  title,
  points,
  children,
}: {
  n: string;
  tag: string;
  title: string;
  points: string[];
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-black/[0.03] shadow-xs">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Pillar {n}</span>
        <Tag>{tag}</Tag>
      </div>
      <div className={cn("relative flex h-56 items-center justify-center overflow-hidden px-6", DOTS)}>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_50%,transparent,var(--card))] opacity-70" />
        <div className="relative w-full max-w-sm">{children}</div>
      </div>
      <div className="border-t p-5">
        <h3 className="font-heading font-semibold text-lg tracking-tight">{title}</h3>
        <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-muted-foreground text-sm leading-5">
              <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/* 1. Streaming: each stage starts before the last one finishes. */
function StreamingVisual() {
  const rows = [
    { label: "Hears you", left: 0, width: 38, tone: "bg-primary/25" },
    { label: "Transcribes", left: 6, width: 38, tone: "bg-primary/40" },
    { label: "Thinks", left: 30, width: 30, tone: "bg-primary/65" },
    { label: "Speaks", left: 44, width: 50, tone: "bg-primary" },
  ];
  return (
    <div className="rounded-xl border bg-background/90 p-4 shadow-black/[0.04] shadow-sm backdrop-blur">
      <div className="relative space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
            <span className="text-[11px] text-muted-foreground">{r.label}</span>
            <div className="relative h-2.5 rounded-full bg-muted">
              <div className={cn("absolute inset-y-0 rounded-full", r.tone)} style={{ left: `${r.left}%`, width: `${r.width}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3.5 flex items-center gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-success" /> Each step starts before the last one ends
      </p>
    </div>
  );
}

/* 2. Code-mixed speech: one sentence, two languages. */
function LanguageVisual() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-background/90 p-4 shadow-black/[0.04] shadow-sm backdrop-blur">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Caller says</p>
        <p className="mt-2 text-base leading-7">
          <span className="border-primary/50 border-b-2 pb-0.5">Mujhe kal shaam ka</span>{" "}
          <span className="border-coral border-b-2 pb-0.5">appointment</span>{" "}
          <span className="border-primary/50 border-b-2 pb-0.5">chahiye</span>
        </p>
        <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary/60" />Hindi</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-coral" />English</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {["हिन्दी", "தமிழ்", "తెలుగు", "বাংলা", "मराठी", "ಕನ್ನಡ"].map((l) => (
          <span key={l} className="rounded-full border bg-background/90 px-2.5 py-0.5 text-xs">{l}</span>
        ))}
      </div>
    </div>
  );
}

/* 3. Turn-taking: the agent stops when a real caller cuts in, and ignores background noise. */
const WAVE = [5, 9, 14, 8, 17, 11, 20, 13, 9, 15, 7, 12, 6, 3, 2, 2, 2];
function TurnVisual() {
  const cut = 12;
  return (
    <div className="rounded-xl border bg-background/90 p-4 shadow-black/[0.04] shadow-sm backdrop-blur">
      <div className="relative flex h-14 items-center">
        {WAVE.map((h, i) => (
          <span key={i} className="flex flex-1 justify-center">
            <span className={cn("w-[3px] rounded-full", i < cut ? "bg-primary" : "bg-muted-foreground/30")} style={{ height: h * 2 }} />
          </span>
        ))}
        <span className="absolute inset-y-0 border-coral border-l border-dashed" style={{ left: `${(cut / WAVE.length) * 100}%` }} />
        <span className="absolute -top-1 rounded bg-coral px-1.5 py-0.5 text-[9px] text-coral-foreground" style={{ left: `calc(${(cut / WAVE.length) * 100}% + 4px)` }}>
          Caller cuts in
        </span>
      </div>
      <div className="mt-3.5 space-y-1.5 border-t pt-3 text-[11px]">
        <p className="flex items-center justify-between text-muted-foreground">
          Cough, TV or a voice nearby <span className="rounded-full bg-muted px-2 py-0.5">Ignored</span>
        </p>
        <p className="flex items-center justify-between">
          The caller actually speaks <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Agent stops</span>
        </p>
      </div>
    </div>
  );
}

/* 4. Failover: a provider fails, the call carries on. */
function FailoverVisual() {
  return (
    <div className="rounded-xl border bg-background/90 p-4 shadow-black/[0.04] shadow-sm backdrop-blur">
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground line-through">Primary voice engine</span>
          <span className="flex items-center gap-1.5 text-destructive-foreground"><i className="size-1.5 rounded-full bg-destructive" />Error</span>
        </div>
        <div className="flex justify-center text-muted-foreground" aria-hidden>
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="M6 0v13M1.5 9 6 13.5 10.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span className="font-medium">Backup voice engine</span>
          <span className="flex items-center gap-1.5 text-success-foreground"><i className="size-1.5 rounded-full bg-success" />Live</span>
        </div>
      </div>
      <p className="mt-3.5 border-t pt-3 text-[11px] text-muted-foreground">The caller hears no gap, and the call continues.</p>
    </div>
  );
}

export function Pillars() {
  return (
    <Section id="quality" className="border-t">
      <SectionHeading
        eyebrow="Why it sounds human"
        title={<>Four things that make an agent feel <Accent>natural</Accent> on the phone.</>}
        description="Speed, language, timing and reliability are what callers notice. Each one is built into every agent you create."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Pillar
          n="01"
          tag="Realtime"
          title="Responds as you speak"
          points={[
            "Speech in and out is streamed, not batched",
            "Starts talking before the whole reply is written",
            "No long awkward pauses between turns",
            "Latency checks built in",
          ]}
        >
          <StreamingVisual />
        </Pillar>
        <Pillar
          n="02"
          tag="Languages"
          title="Speaks the way India speaks"
          points={[
            "Hindi, Tamil, Telugu, Bengali and more",
            "Handles Hinglish and other mixed speech",
            "Reads phone numbers digit by digit",
            "Choose from a gallery of voices",
          ]}
        >
          <LanguageVisual />
        </Pillar>
        <Pillar
          n="03"
          tag="Conversation"
          title="Natural turn-taking"
          points={[
            "Callers can interrupt at any time",
            "Ignores coughs and background chatter",
            "Waits for a sentence to finish",
            "Checks in gently if the line goes quiet",
          ]}
        >
          <TurnVisual />
        </Pillar>
        <Pillar
          n="04"
          tag="Reliability"
          title="Keeps going when a provider fails"
          points={[
            "Automatic backups for speech and language",
            "Switches engine without ending the call",
            "Full transcript for every call",
            "Outcome and cost recorded per call",
          ]}
        >
          <FailoverVisual />
        </Pillar>
      </div>
    </Section>
  );
}
