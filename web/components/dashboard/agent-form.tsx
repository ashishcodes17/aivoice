"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Fragment, startTransition, useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircleIcon, BracesIcon, CheckCircle2Icon, CircleIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, PauseIcon, PencilIcon, Trash2Icon, PlayIcon, EllipsisIcon, LanguagesIcon, PhoneIcon, PlusIcon, SettingsIcon, TypeIcon, WrenchIcon, XIcon, type LucideIcon } from "lucide-react";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { bodyLines, joinSections, parseSections, type Section } from "@/lib/prompt-sections";
import { saveAgent, type ActionState } from "@/app/dashboard/actions";
import { CallbackForm } from "@/components/dashboard/callback-form";
import { Dialog, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { CATALOG, findVoice, liveliness, voiceConfig, type CatalogVoice } from "@/lib/voices";
import type { AgentTemplate } from "@/lib/agent-templates";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";

const defaults: Omit<Agent, "id" | "created_at"> = {
  name: "",
  language: "en-IN",
  llm_model: "openai/gpt-4o-mini",
  stt_provider: "sarvam",
  tts_provider: "sarvam",
  tts_voice: "shubh",
  config: { tts_model: "bulbul:v3", tts_pace: 1 } as Agent["config"],
  first_message: "Hello! Thanks for calling. How can I help you today?",
  system_prompt: `# Persona
A friendly front-desk receptionist. Tone: warm, efficient, patient. If asked whether you are an AI, say you are a virtual assistant and continue.

# Situation
Voice call, inbound or outbound. Today is {{current_date}}.

# Objective
Help the caller with one request and end the call cleanly.

# Speaking style
- Under 25 words per turn, one question at a time, then wait.
- Vary the wording when you re-ask; shorten it, never repeat it word for word.
- Treat "hmm", "haan", "accha", "ok" as listening sounds, not answers.
- If something is unclear, say what you heard and ask the caller to confirm.

# Conversation
1. Greet warmly and ask how you can help.
2. Answer simple questions. Ask for the caller's name and the reason for calling.
3. If you cannot help, say the team will call back and note a convenient time.
4. Make sure the caller knows the next step, thank them, and end the call.

# Guardrails
- Never invent facts or promise anything you cannot do; say you will check with the team.
- Upset caller, legal threat, or a request for a person: stay calm and say a senior representative will reach out.
- Wrong number: apologize and end. Busy: ask when to call back and repeat the time.`,
};

const GENDERS = [
  { value: "all", label: "All" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

const voicesFor = (language: string) =>
  CATALOG.voices.filter((v) => v.languages[language]).sort((a, b) => b.languages[language].clarity - a.languages[language].clarity || a.label.localeCompare(b.label));

/** Pick a voice by listening. The provider and model follow from the voice, so they are never asked. */
function VoicePicker({
  language,
  voice,
  provider,
  onPick,
}: {
  language: string;
  voice: string;
  provider: string;
  onPick: (v: CatalogVoice) => void;
}) {
  const [gender, setGender] = useState<(typeof GENDERS)[number]["value"]>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const all = useMemo(() => voicesFor(language), [language]);
  const list = all.filter((v) => gender === "all" || v.gender === gender);

  function toggle(v: CatalogVoice) {
    const id = `${v.provider}:${v.voice}`;
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const el = new Audio(v.languages[language].file);
    el.onended = () => setPlaying((p) => (p === id ? null : p));
    audio.current = el;
    setPlaying(id);
    el.play().catch(() => setPlaying(null));
  }

  if (all.length === 0) {
    return <p className="rounded-xl border border-dashed p-5 text-muted-foreground text-sm">Voices for this language are coming soon. Your agent keeps its current voice.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filter by voice" className="flex gap-1 rounded-full bg-muted p-1">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="tab"
              aria-selected={gender === g.value}
              onClick={() => setGender(g.value)}
              className={cn("cursor-pointer rounded-full px-3 py-1 text-sm transition-colors", gender === g.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-xs">{list.length} voices. Press play to listen.</span>
      </div>
      <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {list.map((v) => {
          const id = `${v.provider}:${v.voice}`;
          const selected = v.provider === provider && v.voice === voice;
          const live = liveliness(v.languages[language].pitch_sd);
          return (
            <div
              key={id}
              className={cn("flex items-center gap-3 rounded-xl border p-3 transition-colors", selected ? "border-primary bg-primary/5" : "hover:border-primary/30")}
            >
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`${playing === id ? "Pause" : "Play"} ${v.label}`}
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-primary/10"
              >
                {playing === id ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
              </button>
              <button type="button" onClick={() => onPick(v)} className="min-w-0 flex-1 cursor-pointer text-left">
                <span className="block truncate font-medium text-sm">{v.label}</span>
                <span className="block truncate text-muted-foreground text-xs capitalize">
                  {[v.gender !== "unknown" ? v.gender : null, live].filter(Boolean).join(" · ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onPick(v)}
                aria-label={selected ? `${v.label} is selected` : `Use ${v.label}`}
                aria-pressed={selected}
                className={cn("flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors", selected ? "border-primary bg-primary text-primary-foreground" : "text-transparent hover:border-primary/50")}
              >
                <CheckIcon className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BUILT_IN = ["current_date", "current_time"];
const PLACEHOLDER = /\{\{\s*([A-Za-z_]\w*)\s*\}\}/g;
type Row = { id: number; name: string; value: string };
type TabId = "instructions" | "variables" | "tools" | "settings";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "instructions", label: "Instructions", icon: TypeIcon },
  { id: "variables", label: "Variables", icon: BracesIcon },
  { id: "tools", label: "Tools", icon: WrenchIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function usedVariables(...texts: string[]) {
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(PLACEHOLDER)) found.add(m[1]);
  return [...found];
}

function VarChip({ name, empty }: { name: string; empty?: boolean }) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-px align-baseline font-mono text-[0.78em]",
        empty ? "bg-warning/15 text-warning-foreground" : "bg-muted text-foreground/80",
      )}
    >
      <span className="text-muted-foreground">{"{}"}</span>
      {name}
    </span>
  );
}

/** Text with each {{name}} drawn as a chip. */
function ChipText({ text, isEmpty }: { text: string; isEmpty: (n: string) => boolean }) {
  const parts = text.split(/(\{\{\s*[A-Za-z_]\w*\s*\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{\{\s*([A-Za-z_]\w*)\s*\}\}$/);
        return m ? <VarChip key={i} name={m[1]} empty={isEmpty(m[1])} /> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Shows text with chips; click to edit as plain text. Submits its value through a hidden input. */
function ChipField({
  name,
  value,
  onChange,
  placeholder,
  isEmpty,
  className,
  rows = 2,
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isEmpty: (n: string) => boolean;
  className?: string;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      {editing ? (
        <textarea
          autoFocus
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className={cn("w-full resize-y rounded-lg border bg-background p-2 outline-none focus:ring-4 focus:ring-primary/15", className)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn("block w-full cursor-text rounded-lg p-2 text-left transition-colors hover:bg-muted/50", className)}
        >
          {value ? <ChipText text={value} isEmpty={isEmpty} /> : <span className="text-muted-foreground">{placeholder}</span>}
        </button>
      )}
    </>
  );
}

function SectionBlock({
  section,
  onChange,
  onRemove,
  onMove,
  first,
  last,
  isEmpty,
  insertable,
}: {
  section: Section;
  onChange: (s: Section) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  first: boolean;
  last: boolean;
  isEmpty: (n: string) => boolean;
  insertable: string[];
}) {
  const [editing, setEditing] = useState(!section.title && !section.body);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const lines = bodyLines(section.body);

  // Put {{name}} where the cursor is, instead of making people type the braces.
  const insert = (name: string) => {
    const el = area.current;
    const token = `{{${name}}}`;
    const at = el?.selectionStart ?? section.body.length;
    const end = el?.selectionEnd ?? at;
    onChange({ ...section, body: section.body.slice(0, at) + token + section.body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  return (
    <div className={cn("group rounded-xl border bg-card transition-colors", editing ? "border-primary/40 ring-4 ring-primary/10" : "hover:border-primary/30")}>
      {editing ? (
        <div className="space-y-3 p-3 sm:p-4">
          <input
            autoFocus
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Section title, for example Persona"
            aria-label="Section title"
            className="w-full rounded-lg border bg-background px-3 py-2 font-heading font-medium text-lg outline-none focus:ring-4 focus:ring-primary/15"
          />
          <textarea
            ref={area}
            value={section.body}
            onChange={(e) => onChange({ ...section, body: e.target.value })}
            placeholder={"One point per line.\nStart a line with - for a bullet or 1. for a number."}
            aria-label="Section text"
            rows={Math.min(Math.max(section.body.split("\n").length + 1, 5), 22)}
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-[13px] leading-6 outline-none focus:ring-4 focus:ring-primary/15"
          />
          {insertable.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Insert variable</span>
              {insertable.map((n) => (
                <button key={n} type="button" onClick={() => insert(n)} className="cursor-pointer rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-primary/10 hover:text-primary">
                  {n}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <button type="button" onClick={onRemove} className="flex cursor-pointer items-center gap-1.5 text-destructive-foreground text-sm hover:underline">
              <Trash2Icon className="size-3.5" /> Delete
            </button>
            <Button type="button" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${section.title || "section"}`} className="block w-full cursor-text rounded-xl px-4 py-3.5 text-left sm:pr-28">
            {section.title && <h3 className="font-heading font-medium text-lg tracking-tight sm:text-xl">{section.title}</h3>}
            <div className={cn("relative max-h-44 overflow-hidden", section.title && "mt-2")}>
              <ul className="space-y-2 text-[15px] leading-7 sm:text-base">
                {lines.map((l, i) => (
                  <li key={i} className={cn("flex gap-3", l.kind === "text" && "block")}>
                    {l.kind === "bullet" && <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-foreground/70" />}
                    {l.kind === "number" && <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{l.n}.</span>}
                    <span className="min-w-0"><ChipText text={l.text} isEmpty={isEmpty} /></span>
                  </li>
                ))}
                {lines.length === 0 && <li className="text-muted-foreground">Empty. Click to write.</li>}
              </ul>
              {lines.length > 5 && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />}
            </div>
          </button>
          <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move section up" disabled={first} onClick={() => onMove(-1)}>
              <ChevronUpIcon />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move section down" disabled={last} onClick={() => onMove(1)}>
              <ChevronDownIcon />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit section" onClick={() => setEditing(true)}>
              <PencilIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentForm({ agent, template, dangerZone, testNumbers = [] }: { agent?: Agent; template?: AgentTemplate; dangerZone?: React.ReactNode; testNumbers?: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAgent, {});
  const v = agent ?? (template
    ? { ...defaults, name: template.agentName, language: template.language, first_message: template.first_message, system_prompt: template.system_prompt }
    : defaults);

  const [tab, setTab] = useState<TabId>("instructions");
  const [greeting, setGreeting] = useState(v.first_message);
  const [outbound, setOutbound] = useState(v.config?.outbound_first_message ?? "");
  const [sections, setSections] = useState<Section[]>(() => parseSections(v.system_prompt));
  const [nextSection, setNextSection] = useState(sections.length);
  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(agent?.config?.variables ?? template?.variables ?? {}).map(([name, value], i) => ({ id: i, name, value })),
  );
  const [nextId, setNextId] = useState(rows.length);
  const [dirty, setDirty] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [name, setName] = useState(v.name);
  const sample = useRef<HTMLAudioElement | null>(null);
  const [samplePlaying, setSamplePlaying] = useState(false);
  useEffect(() => () => sample.current?.pause(), []);
  const touch = () => setDirty(true);
  const [language, setLanguage] = useState(v.language);
  const [voice, setVoice] = useState(() => {
    // A new agent starts on the clearest voice for its language. An existing agent keeps its own.
    const top = voicesFor(v.language)[0];
    return !agent && top && !findVoice(v.tts_provider, v.tts_voice ?? "", v.language)
      ? { provider: top.provider as string, voice: top.voice, pace: Number(voiceConfig(top, v.language).tts_pace ?? 1) }
      : { provider: v.tts_provider, voice: v.tts_voice ?? "", pace: Number(v.config?.tts_pace ?? 1) };
  });
  const picked = findVoice(voice.provider, voice.voice, language);
  const pickVoice = (c: CatalogVoice, lang = language) => {
    touch();
    setVoice({ provider: c.provider, voice: c.voice, pace: Number(voiceConfig(c, lang).tts_pace ?? 1) });
  };
  const changeLanguage = (next: string) => {
    touch();
    setLanguage(next);
    if (!findVoice(voice.provider, voice.voice, next)) {
      const top = voicesFor(next)[0];
      if (top) pickVoice(top, next);
    }
  };
  // The Save / Test buttons live in the dashboard header, so there is only one header.
  const actionsSlot = useSyncExternalStore(
    () => () => {},
    () => document.getElementById("header-actions"),
    () => null,
  );

  const prompt = useMemo(() => joinSections(sections), [sections]);
  const used = useMemo(() => usedVariables(greeting, outbound, prompt), [greeting, outbound, prompt]);
  const values = Object.fromEntries(rows.filter((r) => r.name.trim()).map((r) => [r.name.trim(), r.value]));
  const isEmpty = (n: string) => !BUILT_IN.includes(n) && !values[n]?.trim();
  const missing = used.filter(isEmpty);

  const addRow = (name = "") => {
    setRows((r) => [...r, { id: nextId, name, value: "" }]);
    touch();
    setNextId(nextId + 1);
  };
  const addMissing = () => {
    const have = new Set(rows.map((r) => r.name));
    let id = nextId;
    const add = missing.filter((n) => !have.has(n)).map((name) => ({ id: id++, name, value: "" }));
    setRows((r) => [...r, ...add]);
    setNextId(id);
    setTab("variables");
    touch();
  };

  // A plain checklist of things worth fixing before the agent takes calls. No AI involved.
  const checks = [
    { ok: greeting.trim().length > 0, label: "Greeting is set", fix: "Add a greeting so the agent speaks first." },
    { ok: missing.length === 0, label: "Every variable has a value", fix: `No value for ${missing.join(", ")}.` },
    { ok: prompt.length > 0 && prompt.length <= 8000, label: "Instructions fit the limit", fix: prompt.length > 8000 ? "Instructions are over 8,000 characters." : "Write some instructions." },
    { ok: /end[\s_-]?call|hang up|end the call|goodbye/i.test(prompt), label: "Says when to end the call", fix: "Tell the agent when the conversation is finished." },
  ];
  const counts: Partial<Record<TabId, number>> = { instructions: sections.length, variables: rows.length, tools: 1 };
  const passed = checks.filter((c) => c.ok).length;
  const filledGreeting = greeting.replace(PLACEHOLDER, (m, n: string) => (BUILT_IN.includes(n) ? m : values[n]?.trim() || m));

  const panel = (id: TabId) => cn(tab !== id && "hidden");

  return (
    <>
    <form
      onSubmit={(e) => {
        // Submit through a handler instead of `action=`, because React clears an action's form
        // when it finishes, which would wipe what the user typed after a validation error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("variables", JSON.stringify(values));
        data.set("system_prompt", prompt);
        startTransition(() => action(data));
      }}
      id="agent-form"
      onChange={touch}
      className="relative"
    >
      {agent && <input type="hidden" name="id" value={agent.id} />}

      {actionsSlot &&
        createPortal(
          <>
            <input
              form="agent-form"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
              aria-label="Agent name"
              className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 font-medium text-sm outline-none placeholder:text-muted-foreground hover:bg-muted/50 focus:bg-background focus:ring-4 focus:ring-primary/15 sm:w-56 sm:flex-none"
            />
            <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground text-xs sm:inline">v1 · {agent ? "Live" : "Draft"}</span>
            {dirty && (
              <span className="mr-1 hidden items-center gap-1.5 text-muted-foreground text-xs md:flex">
                <span className="size-1.5 rounded-full bg-warning" /> Unsaved changes
              </span>
            )}
            {agent && (
              <Button type="button" className="rounded-full bg-foreground text-background hover:bg-foreground/90" aria-label="Test agent" onClick={() => setTestOpen(true)}>
                <PhoneIcon /> <span className="hidden sm:inline">Test agent</span>
              </Button>
            )}
            <Button type="submit" form="agent-form" variant={agent ? "outline" : "default"} className="rounded-full" loading={pending}>
              {agent ? "Save" : "Create agent"}
              <span className="hidden sm:inline">{agent ? " changes" : ""}</span>
            </Button>
            {agent && (
              <Button type="button" variant="outline" size="icon" className="rounded-full" aria-label="Delete agent and more options" onClick={() => {
                  setTab("settings");
                  requestAnimationFrame(() => document.getElementById("danger")?.scrollIntoView({ behavior: "smooth", block: "center" }));
                }}>
                <EllipsisIcon />
              </Button>
            )}
          </>,
          actionsSlot,
        )}


      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_20rem]">
        <nav aria-label="Agent sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 text-left text-sm transition-colors lg:gap-3 lg:px-4 lg:py-2.5 lg:text-base",
                tab === id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} />
              {label}
              {id === "variables" && missing.length > 0 ? (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-warning font-medium text-[11px] text-white">{missing.length}</span>
              ) : (
                counts[id] != null && <span className="ml-auto text-muted-foreground text-xs tabular-nums">{counts[id]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="min-w-0 pb-8">
          {state.error && (
            <Alert variant="error" className="mb-6">
              <AlertCircleIcon />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className={cn("max-w-3xl space-y-8", panel("instructions"))}>
            <section className="rounded-2xl border bg-card p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading font-semibold text-lg tracking-tight">Greeting</h2>
                  <p className="mt-0.5 text-muted-foreground text-sm">The first thing the agent says when a call connects.</p>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-muted-foreground text-sm" title="Set the agent's language in Settings">
                  <LanguagesIcon className="size-4" /> {LANGUAGES.find((l) => l.value === v.language)?.label ?? "Language"}
                </span>
              </div>
              <div className="mt-3 rounded-xl border border-transparent bg-muted/40 transition-colors focus-within:border-primary/30">
                <ChipField name="first_message" value={greeting} onChange={setGreeting} isEmpty={isEmpty} placeholder="Click to write what the agent says first" className="text-lg leading-8 sm:text-xl sm:leading-9" />
              </div>
              <p className={cn("mt-1.5 text-right text-xs tabular-nums", greeting.length > 500 ? "text-destructive-foreground" : "text-muted-foreground")}>{greeting.length} / 500</p>
              <div className="mt-3">
                <p className="mb-1.5 font-medium text-sm">Outbound greeting <span className="font-normal text-muted-foreground">(optional)</span></p>
                <p className="mb-2 text-muted-foreground text-xs">Used when the agent calls someone. Leave empty to reuse the greeting above.</p>
                <input type="hidden" name="outbound_first_message" value={outbound} />
                <div className="rounded-xl border border-transparent bg-muted/40 transition-colors focus-within:border-primary/30">
                  <ChipField value={outbound} onChange={setOutbound} isEmpty={isEmpty} placeholder="Leave empty to use the greeting above" className="text-base leading-8 sm:text-lg" />
                </div>
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-heading font-semibold text-lg tracking-tight">Instructions</h2>
                  <p className="mt-0.5 text-muted-foreground text-sm">Who the agent is and how it should handle the call. Click a section to edit.</p>
                </div>
                <span className={cn("text-xs tabular-nums", prompt.length > 8000 ? "text-destructive-foreground" : "text-muted-foreground")}>
                  {prompt.length.toLocaleString("en-IN")} / 8,000
                </span>
              </div>
              <div className="mt-1 mb-4 h-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", prompt.length > 8000 ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, (prompt.length / 8000) * 100)}%` }} />
              </div>
              <div className="space-y-3">
                {sections.map((s) => (
                  <SectionBlock
                    key={s.id}
                    section={s}
                    isEmpty={isEmpty}
                    insertable={[...rows.map((r) => r.name.trim()).filter(Boolean), ...BUILT_IN]}
                    first={sections[0]?.id === s.id}
                    last={sections[sections.length - 1]?.id === s.id}
                    onMove={(dir) => {
                      touch();
                      setSections((all) => {
                        const i = all.findIndex((x) => x.id === s.id);
                        const j = i + dir;
                        if (j < 0 || j >= all.length) return all;
                        const next = [...all];
                        [next[i], next[j]] = [next[j], next[i]];
                        return next;
                      });
                    }}
                    onChange={(n) => {
                      touch();
                      setSections((all) => all.map((x) => (x.id === s.id ? n : x)));
                    }}
                    onRemove={() => {
                      touch();
                      setSections((all) => all.filter((x) => x.id !== s.id));
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    touch();
                    setSections((all) => [...all, { id: nextSection, title: "", body: "" }]);
                    setNextSection(nextSection + 1);
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-3.5 text-muted-foreground text-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <PlusIcon className="size-4" /> Add section
                </button>
              </div>
            </section>
          </div>

          <div className={cn("max-w-3xl space-y-6", panel("variables"))}>
            <section className="rounded-2xl border bg-card p-4 sm:p-6">
              <h2 className="font-heading font-semibold text-lg tracking-tight">Variables</h2>
              <p className="mt-0.5 text-muted-foreground text-sm">
                Write {"{{name}}"} in the greeting or instructions and the agent uses the value you set here on every call. Change a value once instead of editing the whole prompt.
              </p>
              <div className="mt-5 space-y-2">
                {rows.length > 0 && (
                  <div className="hidden grid-cols-[1fr_1.5fr_2.25rem] gap-2 px-1 text-muted-foreground text-xs sm:grid">
                    <span>Name</span>
                    <span>Value</span>
                    <span />
                  </div>
                )}
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                    <Input
                      value={r.name}
                      aria-label="Variable name"
                      placeholder="serviceProviderName"
                      className="font-mono"
                      onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, name: e.target.value.replace(/[^\w]/g, "") } : x)))}
                    />
                    <Input
                      value={r.value}
                      className="order-last col-span-2 sm:order-none sm:col-span-1"
                      aria-label={`Value for ${r.name || "variable"}`}
                      placeholder="Value"
                      onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="sm:order-last"
                      aria-label="Remove variable"
                      onClick={() => {
                        touch();
                        setRows((all) => all.filter((x) => x.id !== r.id));
                      }}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                {rows.length === 0 && (
                  <div className="rounded-xl border border-dashed p-8 text-center">
                    <BracesIcon className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-2 font-medium text-sm">No variables yet</p>
                    <p className="mt-0.5 text-muted-foreground text-sm">Add one for anything that changes, like a business name or an address.</p>
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addRow()}>
                  <PlusIcon /> Add variable
                </Button>
              </div>
            </section>
            <div className="rounded-2xl border bg-muted/30 p-4 text-sm sm:p-5">
              <p className="font-medium">Always available</p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-mono">{"{{current_date}}"}</span> and <span className="font-mono">{"{{current_time}}"}</span> are filled in by the system on every call, in Indian time.
              </p>
            </div>
          </div>

          <div className={cn("max-w-3xl space-y-6", panel("tools"))}>
            <section className="rounded-2xl border bg-card p-4 sm:p-6">
              <h2 className="font-heading font-semibold text-lg tracking-tight">Tools</h2>
              <p className="mt-0.5 text-muted-foreground text-sm">Actions the agent can take during a call.</p>
              <div className="mt-5 flex items-start gap-3 rounded-xl border p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PhoneIcon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-sm">
                    End call <span className="rounded-full bg-success/10 px-2 py-0.5 font-normal text-[11px] text-success-foreground">Always on</span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground text-sm">Lets the agent hang up politely once the conversation is finished.</p>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-dashed p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><WrenchIcon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-sm">
                    Custom tools <span className="rounded-full bg-muted px-2 py-0.5 font-normal text-[11px] text-muted-foreground">Coming soon</span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground text-sm">Check a calendar or book a slot. Until then, write your instructions so the agent collects the details and a person confirms them.</p>
                </div>
              </div>
            </section>
          </div>

          <div className={cn("max-w-3xl space-y-6", panel("settings"))}>
            <input type="hidden" name="language" value={language} />
            <input type="hidden" name="tts_provider" value={voice.provider} />
            <input type="hidden" name="tts_voice" value={voice.voice} />
            <input type="hidden" name="stt_provider" value={v.stt_provider} />
            <input type="hidden" name="llm_model" value={v.llm_model} />

            <section className="rounded-2xl border bg-card p-4 sm:p-6">
              <h2 className="font-heading font-semibold text-lg tracking-tight">Language</h2>
              <p className="mt-0.5 text-muted-foreground text-sm">The language your callers speak. The agent listens and replies in it.</p>
              <div className="mt-4 max-w-xs">
                <Select items={LANGUAGES} value={language} onValueChange={(x) => changeLanguage(String(x))}>
                  <SelectTrigger aria-label="Language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading font-semibold text-lg tracking-tight">Voice</h2>
                  <p className="mt-0.5 text-muted-foreground text-sm">Listen and pick how your agent sounds.</p>
                </div>
                {picked && (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary text-sm">
                    <CheckIcon className="size-3.5" /> {picked.label}
                  </span>
                )}
              </div>
              <VoicePicker key={language} language={language} voice={voice.voice} provider={voice.provider} onPick={(c) => pickVoice(c)} />
              {voice.provider === "sarvam" && (
                <div className="mt-5 border-t pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="pace" className="font-medium text-sm">Speaking speed</label>
                    <span className="text-muted-foreground text-sm tabular-nums">{voice.pace.toFixed(2)}x</span>
                  </div>
                  <input
                    id="pace"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={voice.pace}
                    onChange={(e) => {
                      touch();
                      setVoice((x) => ({ ...x, pace: Number(e.target.value) }));
                    }}
                    className="mt-2 w-full accent-primary"
                  />
                  <p className="mt-1 text-muted-foreground text-xs">1x is normal. Try 1.1x for a slightly quicker voice.</p>
                </div>
              )}
              <input type="hidden" name="tts_pace" value={voice.pace} />
            </section>
          </div>
        </div>

        <aside className="order-last space-y-4 xl:order-none xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <AgentAvatar seed={agent?.id ?? "new-agent"} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name.trim() || "Your agent"}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {LANGUAGES.find((l) => l.value === language)?.label}
                  {picked ? ` · ${picked.label}` : ""}
                </p>
              </div>
              {picked && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label={samplePlaying ? "Stop sample" : "Hear the voice"}
                  onClick={() => {
                    sample.current?.pause();
                    if (samplePlaying) return setSamplePlaying(false);
                    const el = new Audio(picked.languages[language].file);
                    el.onended = () => setSamplePlaying(false);
                    sample.current = el;
                    setSamplePlaying(true);
                    el.play().catch(() => setSamplePlaying(false));
                  }}
                >
                  {samplePlaying ? <PauseIcon /> : <PlayIcon />}
                </Button>
              )}
            </div>
            <p className="mt-5 text-muted-foreground text-xs uppercase tracking-wide">The first thing callers hear</p>
            <div className="mt-2 rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-[15px] leading-6">
              {filledGreeting || <span className="text-muted-foreground">No greeting yet.</span>}
            </div>
            <p className="mt-5 text-muted-foreground text-xs uppercase tracking-wide">Variables in use</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
              {used.length ? used.map((n) => <VarChip key={n} name={n} empty={isEmpty(n)} />) : <span className="text-muted-foreground">None yet. Write {"{{name}}"} in your text.</span>}
            </div>
            {missing.length > 0 && (
              <button type="button" onClick={addMissing} className="mt-3 text-sm text-warning-foreground underline underline-offset-4">
                Add {missing.length} missing {missing.length === 1 ? "variable" : "variables"}
              </button>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Ready to take calls?</p>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", passed === checks.length ? "bg-success/10 text-success-foreground" : "bg-warning/15 text-warning-foreground")}>
                {passed}/{checks.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", passed === checks.length ? "bg-success" : "bg-warning")} style={{ width: `${(passed / checks.length) * 100}%` }} />
            </div>
            <ul className="mt-4 space-y-2.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  {c.ok ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success-foreground" /> : <CircleIcon className="mt-0.5 size-4 shrink-0 text-warning-foreground" />}
                  <span className={cn(c.ok && "text-muted-foreground")}>
                    {c.label}
                    {!c.ok && <span className="block text-muted-foreground text-xs">{c.fix}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

    </form>
    {/* Outside the form, since it has a form of its own. Lines up with the content column. */}
    {agent && (
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Test {agent.name}</DialogTitle>
            <DialogDescription>Enter your phone number and this agent will call it, so you can hear how it sounds.{dirty ? " The call uses the last saved version, so save first to hear your changes." : ""}</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {testNumbers.length ? (
              <CallbackForm numbers={testNumbers} agents={[]} fixedAgentId={agent.id} />
            ) : (
              <p className="text-muted-foreground text-sm">
                To place a test call, connect a phone number first.{" "}
                <Link href="/dashboard/numbers" className="font-medium text-foreground underline underline-offset-4">Go to Numbers</Link>
              </p>
            )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    )}
    {dangerZone && tab === "settings" && <div className="max-w-3xl lg:ml-56">{dangerZone}</div>}
    </>
  );
}
