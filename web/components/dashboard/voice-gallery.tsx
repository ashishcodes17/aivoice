"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, CheckIcon, PauseIcon, PlayIcon } from "lucide-react";
import { setAgentVoice, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CALL_LANGUAGES, CALL_PROVIDERS } from "@/lib/call-voices";
import { CATALOG, languageLabel, providerLabel, type CatalogVoice } from "@/lib/voices";

type AgentOption = { id: string; name: string; language: string; tts_provider: string; tts_voice: string | null };

const ALL = "all";
const providerItems = [{ value: ALL, label: "All voices" }, ...CALL_PROVIDERS];
const genderItems = [
  { value: ALL, label: "Any" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

export function VoiceGallery({ agents }: { agents: AgentOption[] }) {
  const [language, setLanguage] = useState(agents[0]?.language ?? "te-IN");
  const [provider, setProvider] = useState(ALL);
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
        .filter((v) => v.languages[language] && (provider === ALL || v.provider === provider) && (gender === ALL || v.gender === gender))
        .sort((a, b) => b.languages[language].clarity - a.languages[language].clarity || a.label.localeCompare(b.label)),
    [language, provider, gender],
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

  const languageItems = CALL_LANGUAGES.map((l) => ({ value: l.value, label: l.label }));
  const agentItems = matching.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4">
        <Field>
          <FieldLabel>Language</FieldLabel>
          <Select
            items={languageItems}
            value={language}
            onValueChange={(v) => {
              const next = String(v);
              setLanguage(next);
              setAgentId(agents.find((a) => a.language === next)?.id ?? "");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {languageItems.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Provider</FieldLabel>
          <Select items={providerItems} value={provider} onValueChange={(v) => setProvider(String(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {providerItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Voice type</FieldLabel>
          <Select items={genderItems} value={gender} onValueChange={(v) => setGender(String(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {genderItems.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Use for agent</FieldLabel>
          {agentItems.length ? (
            <Select items={agentItems} value={agent?.id ?? ""} onValueChange={(v) => setAgentId(String(v))}>
              <SelectTrigger>
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
            <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-sm">No {languageLabel(language)} agent yet.</p>
          )}
        </Field>
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

      <p className="text-muted-foreground text-sm">
        {voices.length} {voices.length === 1 ? "voice" : "voices"} for {languageLabel(language)}. Every sample is the same greeting at the same volume, in phone quality, so what you hear is what callers hear.
        Clarity is how well speech recognition could read the voice back (1.00 is perfect).
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {voices.map((v) => {
          const sample = v.languages[language];
          const id = `${v.provider}:${v.voice}:${language}`;
          const isPlaying = playing === id;
          const current = agent?.tts_provider === v.provider && agent?.tts_voice === v.voice;
          return (
            <li key={id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{v.label}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{providerLabel(v.provider)}</Badge>
                    {v.gender !== "unknown" && (
                      <Badge variant="secondary" className="capitalize">
                        {v.gender}
                      </Badge>
                    )}
                    {current && <Badge variant="success">In use</Badge>}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant={isPlaying ? "default" : "outline"}
                  aria-label={isPlaying ? `Stop ${v.label}` : `Play ${v.label}`}
                  onClick={() => toggle(v)}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </Button>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="tabular-nums">Clarity {sample.clarity.toFixed(2)}</span>
                <span className="tabular-nums">{sample.seconds.toFixed(0)} s sample</span>
              </div>
              <Button type="button" variant={current ? "secondary" : "outline"} size="sm" disabled={!agent || pending || current} onClick={() => use(v)}>
                {current ? <CheckIcon /> : null}
                {current ? "Current voice" : agent ? `Use for ${agent.name}` : "No agent to use it for"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
