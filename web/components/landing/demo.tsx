"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckCircle2Icon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoCalls } from "@/lib/demo-calls";
import { cn } from "@/lib/utils";
import { Accent, Section, SectionHeading } from "./section";

export function Demo() {
  const [id, setId] = useState(demoCalls[0].id);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [ended, setEnded] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const call = demoCalls.find((c) => c.id === id) ?? demoCalls[0];

  useEffect(() => {
    setPlaying(false);
    setEnded(false);
    setTime(0);
    feed.current?.scrollTo({ top: 0 });
  }, [id]);

  // When a line starts: agent lines use their own timestamp; a caller line starts where the next agent line does.
  const starts = call.lines.map((l, i) => {
    if (l.at !== undefined) return l.at;
    const next = call.lines.slice(i + 1).find((n) => n.at !== undefined);
    return next?.at ?? call.duration;
  });
  const active = starts.reduce((n, st, i) => (time >= st ? i : n), -1);
  const progress = Math.min(100, (time / call.duration) * 100);

  // Keep the live line in view inside the transcript only, never scrolling the whole page.
  useEffect(() => {
    if (!playing || active < 0) return;
    const box = feed.current;
    const el = box?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    if (box && el) box.scrollTo({ top: Math.max(el.offsetTop - 24, 0), behavior: "smooth" });
  }, [active, playing]);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }
  function seek(to: number, play = false) {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(to, call.duration));
    setTime(a.currentTime);
    setEnded(false);
    if (play) void a.play();
  }
  function nextCall() {
    const i = demoCalls.findIndex((c) => c.id === id);
    setId(demoCalls[(i + 1) % demoCalls.length].id);
  }

  return (
    <Section id="demo" className="border-t">
      <SectionHeading
        align="center"
        eyebrow="Hear it live"
        title={
          <>
            Hear how it sounds before you <Accent>sign up</Accent>.
          </>
        }
        description="Scripted scenario calls spoken end to end by Gnani Timbre v3, agent and caller. Pick a use case and press play. Tap any line to jump to it."
      />

      <div className="mx-auto mt-12 max-w-3xl">
        <div role="tablist" aria-label="Use cases" className="grid gap-2 sm:grid-cols-2">
          {demoCalls.map((c) => (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={c.id === id}
              onClick={() => setId(c.id)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                c.id === id
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                  : "bg-card hover:border-primary/40",
              )}
            >
              <span>
                <span className="block font-medium text-sm">{c.tab}</span>
                <span className="block text-muted-foreground text-xs">{c.language}</span>
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  c.id === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <PlayIcon className="size-3.5" />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-black/[0.06] shadow-xl">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-4">
              <Button
                size="icon-lg"
                className="rounded-full"
                onClick={toggle}
                aria-label={playing ? "Pause the call" : "Play the call"}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-sm">{call.agent}</span>
                  <span className="flex items-center gap-2 font-mono text-muted-foreground text-xs tabular-nums">
                    {playing && <Bars />}
                    {fmt(time)} / {fmt(call.duration)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={call.duration}
                  step={0.1}
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Seek through the call"
                  style={{ ["--pct" as string]: `${progress}%` }}
                  className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,var(--primary)_var(--pct),var(--muted)_var(--pct))] outline-none focus-visible:ring-4 focus-visible:ring-primary/20 [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
              </div>
            </div>
          </div>

          <audio
            key={call.id}
            ref={audio}
            src={call.audio}
            preload="none"
            onPlay={() => {
              setPlaying(true);
              setEnded(false);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
            }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          />

          <div ref={feed} className="relative max-h-[26rem] space-y-4 overflow-y-auto scroll-smooth px-5 py-5">
            {call.lines.map((l, i) => {
              const isAgent = l.who === "agent";
              const started = time >= starts[i] || (!playing && time === 0);
              const live = i === active && playing;
              const idle = time === 0 && !playing && !ended;
              return (
                <div key={i} data-line={i} className={isAgent ? "flex" : "flex justify-end"}>
                  <button
                    type="button"
                    onClick={() => seek(starts[i], true)}
                    aria-label={`Play from this ${isAgent ? "agent" : "caller"} line`}
                    className={cn(
                      "max-w-[88%] cursor-pointer text-left transition-opacity duration-300",
                      idle || started || ended ? "opacity-100" : "opacity-40",
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1.5 flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.12em]",
                        !isAgent && "justify-end",
                      )}
                    >
                      {live && <i className="size-1.5 animate-pulse rounded-full bg-success" />}
                      {isAgent ? "Agent" : "Caller"}
                    </span>
                    <span
                      className={cn(
                        "block rounded-2xl px-4 py-2.5 text-sm leading-6 transition-shadow",
                        isAgent
                          ? "rounded-tl-md bg-muted text-foreground"
                          : "rounded-tr-md bg-primary text-primary-foreground",
                        live && "ring-2 ring-primary/50 ring-offset-2 ring-offset-card",
                      )}
                    >
                      {l.text}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {ended ? (
            <div className="flex flex-wrap items-center gap-3 border-t bg-success/10 px-5 py-3.5">
              <CheckCircle2Icon className="size-5 text-success-foreground" />
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-medium">Result:</span> {call.outcome}
              </p>
              <Button variant="outline" size="sm" onClick={() => seek(0, true)}>
                <RotateCcwIcon /> Replay
              </Button>
              <Button variant="outline" size="sm" onClick={nextCall}>
                Next call <ArrowRightIcon />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-3">
              <Badge variant="outline">{call.language}</Badge>
              <Badge variant="outline">{call.outcome}</Badge>
              <span className="ml-auto text-muted-foreground text-xs">
                Voices by Gnani AI · scripted scenario
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Button size="xl" render={<Link href={`/signup?usecase=${call.id}`} />}>
            Build an agent like this
            <ArrowRightIcon />
          </Button>
          <p className="text-muted-foreground text-sm">Write a prompt, pick a voice and take your first call today.</p>
        </div>
      </div>
    </Section>
  );
}

function Bars() {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {[0, 150, 300, 100].map((d) => (
        <i key={d} className="w-[2px] animate-pulse rounded-full bg-primary" style={{ height: `${55 + ((d / 3) % 45)}%`, animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
