"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, CheckIcon, PauseIcon, PlayIcon } from "lucide-react";
import { setAgentVoice, type ActionState } from "@/app/dashboard/actions";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CALL_LANGUAGES } from "@/lib/call-voices";
import { CATALOG, languageLabel, liveliness, type CatalogVoice } from "@/lib/voices";
import { cn } from "@/lib/utils";

type AgentOption = { id: string; name: string; language: string; tts_provider: string; tts_voice: string | null };

const ALL = "all";
const GENDERS = [
  { value: ALL, label: "All" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

function Segmented<T extends string>({ items, value, onChange, label }: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-muted p-1">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn("cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors", value === i.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function VoiceGallery({ agents }: { agents: AgentOption[] }) {
  const [language, setLanguage] = useState(agents[0]?.language ?? "te-IN");
  const [gender, setGender] = useState(ALL);
  const matching = agents.filter((a) => a.language === language);
  const [agentId, setAgentId] = useState(matching[0]?.id ?? "");
  const agent = matching.find((a) => a.id === agentId) ?? matching[0];

  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(setAgentVoice, {});

  useEffect(() => () => audio.current?.pause(), []);

  const voices = useMemo(
    () =>
      CATALOG.voices
        .filter((v) => v.languages[language] && (gender === ALL || v.gender === gender))
        .sort((a, b) => b.languages[language].clarity - a.languages[language].clarity || a.label.localeCompare(b.label)),
    [language, gender],
  );

  function toggle(v: CatalogVoice) {
    const id = `${v.provider}:${v.voice}:${language}`;
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const el = new Audio(v.languages[language].file);
    el.onended = () => setPlaying((p) => (p === id ? null : p));
    audio.current = el;
    setPlaying(id);
    el.play().catch(() => setPlaying(null));
  }

  function use(v: CatalogVoice) {
    if (!agent) return;
    const data = new FormData();
    data.set("agent_id", agent.id);
    data.set("provider", v.provider);
    data.set("voice", v.voice);
    data.set("language", language);
    startTransition(() => action(data));
  }

  const languageItems = CALL_LANGUAGES.map((l) => ({ value: l.value as string, label: l.label as string }));
  const agentItems = matching.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Segmented
          label="Language"
          items={languageItems}
          value={language}
          onChange={(next) => {
            setLanguage(next);
            setAgentId(agents.find((a) => a.language === next)?.id ?? "");
          }}
        />
        <Segmented label="Voice type" items={GENDERS} value={gender} onChange={setGender} />
        <div className="flex min-w-0 items-center gap-2 sm:ml-auto">
          <span className="shrink-0 text-muted-foreground text-sm">Use for</span>
          {agentItems.length ? (
            <Select items={agentItems} value={agent?.id ?? ""} onValueChange={(v) => setAgentId(String(v))}>
              <SelectTrigger className="min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {agentItems.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : (
            <span className="rounded-lg border border-dashed px-3 py-1.5 text-muted-foreground text-sm">No {languageLabel(language)} agent yet</span>
          )}
        </div>
      </div>

      {state.error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.message && (
        <Alert variant="success">
          <CheckCircle2Icon />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="font-heading font-semibold text-lg tracking-tight">
          {languageLabel(language)} voices <span className="font-normal text-muted-foreground text-sm">· {voices.length}</span>
        </h2>
        <p className="mt-0.5 max-w-2xl text-muted-foreground text-sm">Every sample is the same greeting at the same volume, in phone quality, so what you hear is what callers hear.</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {voices.map((v) => {
          const sample = v.languages[language];
          const id = `${v.provider}:${v.voice}:${language}`;
          const isPlaying = playing === id;
          const current = agent?.tts_provider === v.provider && agent?.tts_voice === v.voice;
          const tone = liveliness(sample.pitch_sd);
          return (
            <li key={id} className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-all sm:p-5", current ? "border-primary/50 bg-primary/5" : "hover:border-primary/25 hover:shadow-md", isPlaying && "border-primary/40 shadow-md")}>
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  aria-label={isPlaying ? `Stop ${v.label}` : `Play ${v.label}`}
                  className="group relative shrink-0 cursor-pointer rounded-full"
                >
                  <AgentAvatar seed={`${v.provider}:${v.voice}`} className={cn("size-14 transition-transform group-hover:scale-105", isPlaying && "ring-4 ring-primary/25")} />
                  <span className={cn("absolute inset-0 flex items-center justify-center rounded-full text-white transition-colors", isPlaying ? "bg-black/35" : "bg-black/10 group-hover:bg-black/30")}>
                    {isPlaying ? <PauseIcon className="size-5 fill-current" /> : <PlayIcon className="size-5 fill-current drop-shadow" />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-heading font-semibold text-base tracking-tight">
                    {v.label}
                    {current && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-normal text-primary text-[11px]">In use</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs capitalize">
                    {v.gender !== "unknown" && <span>{v.gender}</span>}
                    {tone && (
                      <span className="normal-case" title="How much the pitch moves. Flat voices sound robotic on a phone.">
                        · {tone} tone
                      </span>
                    )}
                    <span className="normal-case tabular-nums">· {sample.seconds.toFixed(0)}s</span>
                  </p>
                </div>
              </div>
              <Button type="button" variant={current ? "secondary" : "outline"} size="sm" disabled={!agent || pending || current} onClick={() => use(v)}>
                {current && <CheckIcon />}
                {current ? "Current voice" : agent ? `Use for ${agent.name}` : "No agent to use it for"}
              </Button>
            </li>
          );
        })}
        {voices.length === 0 && <li className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground text-sm">No voices match these filters.</li>}
      </ul>
    </div>
  );
}
