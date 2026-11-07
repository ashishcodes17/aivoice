"use client";

import Link from "next/link";
import { Fragment, startTransition, useActionState, useMemo, useState } from "react";
import { AlertCircleIcon, BracesIcon, CheckCircle2Icon, ChevronLeftIcon, ClipboardCheckIcon, EllipsisIcon, LanguagesIcon, PhoneIcon, PlusIcon, SettingsIcon, SparklesIcon, TypeIcon, WrenchIcon, XIcon, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/landing/logo";
import { bodyLines, joinSections, parseSections, type Section } from "@/lib/prompt-sections";
import { saveAgent, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, SARVAM_TTS_MODELS, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/languages";
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
  system_prompt:
    "You are a friendly receptionist. Greet callers, answer simple questions, and politely ask for their name and reason for calling. Keep every reply to one or two short sentences.",
};

function Choice({
  name,
  label,
  items,
  defaultValue,
}: {
  name: string;
  label: string;
  items: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select name={name} defaultValue={defaultValue} items={items}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </Field>
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-block border-muted-foreground/50 border-b border-dotted pb-px text-[15px] text-muted-foreground">{children}</p>
  );
}

function SectionBlock({
  section,
  onChange,
  onRemove,
  isEmpty,
}: {
  section: Section;
  onChange: (s: Section) => void;
  onRemove: () => void;
  isEmpty: (n: string) => boolean;
}) {
  const [editing, setEditing] = useState(!section.title && !section.body);
  const lines = bodyLines(section.body);
  return (
    <div className="rounded-lg bg-muted/60">
      {editing ? (
        <div className="space-y-2 p-3">
          <input
            autoFocus
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Section title"
            aria-label="Section title"
            className="w-full rounded-md border bg-background px-3 py-2 font-medium text-xl outline-none focus:ring-4 focus:ring-primary/15"
          />
          <textarea
            value={section.body}
            onChange={(e) => onChange({ ...section, body: e.target.value })}
            placeholder={"One point per line.\nStart a line with - for a bullet or 1. for a number."}
            aria-label="Section text"
            rows={Math.min(Math.max(section.body.split("\n").length + 1, 4), 22)}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-[13px] leading-6 outline-none focus:ring-4 focus:ring-primary/15"
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={onRemove} className="text-destructive-foreground text-sm hover:underline">
              Delete section
            </button>
            <Button type="button" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${section.title || "section"}`} className="block w-full cursor-text rounded-lg px-3 py-2.5 text-left">
          {section.title && <h3 className="font-heading font-medium text-2xl tracking-tight">{section.title}</h3>}
          <ul className={cn("space-y-2.5 text-[17px] leading-8", section.title && "mt-2")}>
            {lines.map((l, i) => (
              <li key={i} className={cn("flex gap-3", l.kind === "text" && "block")}>
                {l.kind === "bullet" && <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-foreground" />}
                {l.kind === "number" && <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{l.n}.</span>}
                <span className="min-w-0"><ChipText text={l.text} isEmpty={isEmpty} /></span>
              </li>
            ))}
            {lines.length === 0 && <li className="text-muted-foreground">Empty. Click to write.</li>}
          </ul>
        </button>
      )}
    </div>
  );
}

export function AgentForm({ agent, template }: { agent?: Agent; template?: AgentTemplate }) {
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
  const [review, setReview] = useState(false);

  const prompt = useMemo(() => joinSections(sections), [sections]);
  const used = useMemo(() => usedVariables(greeting, outbound, prompt), [greeting, outbound, prompt]);
  const values = Object.fromEntries(rows.filter((r) => r.name.trim()).map((r) => [r.name.trim(), r.value]));
  const isEmpty = (n: string) => !BUILT_IN.includes(n) && !values[n]?.trim();
  const missing = used.filter(isEmpty);

  const addRow = (name = "") => {
    setRows((r) => [...r, { id: nextId, name, value: "" }]);
    setNextId(nextId + 1);
  };
  const addMissing = () => {
    const have = new Set(rows.map((r) => r.name));
    let id = nextId;
    const add = missing.filter((n) => !have.has(n)).map((name) => ({ id: id++, name, value: "" }));
    setRows((r) => [...r, ...add]);
    setNextId(id);
    setTab("variables");
    setReview(false);
  };

  // A plain checklist of things worth fixing before the agent takes calls. No AI involved.
  const checks = [
    { ok: greeting.trim().length > 0, label: "Greeting is set", fix: "Add a greeting so the agent speaks first." },
    { ok: missing.length === 0, label: "Every variable has a value", fix: `No value for ${missing.join(", ")}.` },
    { ok: prompt.length > 0 && prompt.length <= 8000, label: "Instructions fit the limit", fix: prompt.length > 8000 ? "Instructions are over 8,000 characters." : "Write some instructions." },
    { ok: /end[\s_-]?call|hang up|end the call|goodbye/i.test(prompt), label: "Says when to end the call", fix: "Tell the agent when the conversation is finished." },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const filledGreeting = greeting.replace(PLACEHOLDER, (m, n: string) => (BUILT_IN.includes(n) ? m : values[n]?.trim() || m));

  const panel = (id: TabId) => cn(tab !== id && "hidden");

  return (
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
      className="relative"
    >
      {agent && <input type="hidden" name="id" value={agent.id} />}

      <header className="flex flex-wrap items-center gap-3 pb-6">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to agents" render={<Link href="/dashboard/agents" />}>
          <ChevronLeftIcon className="size-5" />
        </Button>
        <LogoMark className="size-9 shrink-0" />
        <input
          name="name"
          required
          defaultValue={v.name}
          placeholder="Agent name"
          aria-label="Agent name"
          className="min-w-0 max-w-[22rem] flex-1 truncate rounded-md bg-transparent px-1 py-0.5 text-[19px] text-foreground/70 outline-none placeholder:text-muted-foreground focus:text-foreground focus:ring-4 focus:ring-primary/15"
        />
        <span className="text-muted-foreground/60 text-xl">/</span>
        <span className="text-[19px]">v1 · {agent ? "Live" : "Draft"}</span>
        <div className="ml-auto flex items-center gap-2.5">
          {agent ? (
            <Button type="button" size="xl" className="rounded-full bg-foreground px-6 text-background hover:bg-foreground/90" render={<Link href="/dashboard/numbers" />}>
              <PhoneIcon /> Test agent
            </Button>
          ) : null}
          <Button type="submit" size="xl" variant={agent ? "outline" : "default"} className="rounded-full px-6" loading={pending}>
            {agent ? "Save changes" : "Create agent"}
          </Button>
          {agent && (
            <Button type="button" variant="outline" size="icon-xl" className="rounded-full" aria-label="More options" render={<a href="#danger" />}>
              <EllipsisIcon />
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)_20rem]">
        <nav aria-label="Agent sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:self-start">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id}
              className={cn(
                "flex cursor-pointer items-center gap-3.5 whitespace-nowrap rounded-full px-4 py-2.5 text-left text-base transition-colors",
                tab === id ? "bg-muted" : "hover:bg-muted/50",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} />
              {label}
              {id === "variables" && missing.length > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-warning font-medium text-[11px] text-white">{missing.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="min-w-0 pb-28">
          {state.error && (
            <Alert variant="error" className="mb-6">
              <AlertCircleIcon />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className={cn("max-w-3xl space-y-9", panel("instructions"))}>
            <div>
              <div className="flex items-start justify-between gap-4">
                <Label>Greeting</Label>
                <span className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-[15px] text-muted-foreground" title="Set the agent's language in Settings">
                  <LanguagesIcon className="size-4" /> Translations
                </span>
              </div>
              <div className="mt-3 max-w-[40rem]">
                <ChipField name="first_message" value={greeting} onChange={setGreeting} isEmpty={isEmpty} placeholder="Click to write what the agent says first" className="text-xl leading-9" />
              </div>
              <div className="mt-5 max-w-[40rem]">
                <p className="mb-1 text-muted-foreground text-sm">When the agent calls someone (optional)</p>
                <input type="hidden" name="outbound_first_message" value={outbound} />
                <ChipField value={outbound} onChange={setOutbound} isEmpty={isEmpty} placeholder="Leave empty to use the greeting above" className="text-lg leading-8" />
              </div>
            </div>

            <div>
              <Label>Instructions</Label>
              <div className="mt-5 space-y-3">
                {sections.map((s) => (
                  <SectionBlock
                    key={s.id}
                    section={s}
                    isEmpty={isEmpty}
                    onChange={(n) => setSections((all) => all.map((x) => (x.id === s.id ? n : x)))}
                    onRemove={() => setSections((all) => all.filter((x) => x.id !== s.id))}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSections((all) => [...all, { id: nextSection, title: "", body: "" }]);
                    setNextSection(nextSection + 1);
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-muted-foreground text-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <PlusIcon className="size-4" /> Add section
                </button>
                <p className="text-right text-muted-foreground text-xs">{prompt.length.toLocaleString("en-IN")} / 8,000 characters</p>
              </div>
            </div>
          </div>

          <div className={cn("max-w-3xl space-y-6", panel("variables"))}>
            <div>
              <h2 className="font-heading font-semibold text-lg tracking-tight">Variables</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Write {"{{name}}"} in the greeting or instructions and the agent uses the value you set here on every call. Change a value once instead of editing the whole prompt.
              </p>
            </div>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2">
                  <Input
                    value={r.name}
                    aria-label="Variable name"
                    placeholder="serviceProviderName"
                    className="font-mono"
                    onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, name: e.target.value.replace(/[^\w]/g, "") } : x)))}
                  />
                  <Input
                    value={r.value}
                    aria-label={`Value for ${r.name || "variable"}`}
                    placeholder="Value"
                    onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove variable" onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))}>
                    <XIcon />
                  </Button>
                </div>
              ))}
              {rows.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">No variables yet.</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
                <PlusIcon /> Add variable
              </Button>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Always available</p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-mono">{"{{current_date}}"}</span> and <span className="font-mono">{"{{current_time}}"}</span> are filled in by the system on every call, in Indian time.
              </p>
            </div>
          </div>

          <div className={cn("max-w-3xl space-y-6", panel("tools"))}>
            <div>
              <h2 className="font-heading font-semibold text-lg tracking-tight">Tools</h2>
              <p className="mt-1 text-muted-foreground text-sm">Actions the agent can take during a call.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PhoneIcon className="size-4" /></span>
              <div>
                <p className="font-medium text-sm">End call <span className="ml-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success-foreground">Always on</span></p>
                <p className="mt-0.5 text-muted-foreground text-sm">Lets the agent hang up politely once the conversation is finished.</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Custom tools, such as checking a calendar or booking a slot, are not available yet. Until then, write your instructions so the agent collects the details and a person confirms them.
            </p>
          </div>

          <div className={cn("max-w-3xl space-y-6", panel("settings"))}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Choice name="language" label="Language" items={LANGUAGES} defaultValue={v.language} />
              <Choice name="stt_provider" label="Speech recognition" items={STT_PROVIDERS} defaultValue={v.stt_provider} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Choice name="tts_provider" label="Voice provider" items={TTS_PROVIDERS} defaultValue={v.tts_provider} />
              <Field>
                <FieldLabel>Voice</FieldLabel>
                <Input name="tts_voice" defaultValue={v.tts_voice ?? ""} placeholder="shubh" />
                <FieldDescription>
                  Not sure which? <Link href="/dashboard/voices" className="font-medium underline underline-offset-4">Listen to the voices</Link> and pick one. Or type a Sarvam speaker, an ElevenLabs voice ID, or a Rumik speaker.
                </FieldDescription>
              </Field>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Choice name="tts_model" label="Voice model" items={SARVAM_TTS_MODELS} defaultValue={v.config?.tts_model ?? "bulbul:v3"} />
              <Field>
                <FieldLabel>Speaking speed</FieldLabel>
                <Input name="tts_pace" type="number" step="0.05" min="0.5" max="2" defaultValue={v.config?.tts_pace ?? 1} />
                <FieldDescription>1 is normal. Try 1.1 for a slightly quicker voice. Sarvam only. v4 voices have their own names, like kavitha_te_conversation.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel>Model</FieldLabel>
              <Input name="llm_model" required defaultValue={v.llm_model} placeholder="openai/gpt-4o-mini" />
              <FieldDescription>Any model ID from OpenRouter.</FieldDescription>
            </Field>
          </div>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6 rounded-2xl border p-5">
            <div className="flex items-center gap-2.5 font-medium text-lg">
              <SparklesIcon className="size-5" /> Preview
            </div>
            <p className="mt-5 text-muted-foreground text-sm">The first thing callers hear</p>
            <div className="mt-2 rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-[15px] leading-6">
              {filledGreeting || <span className="text-muted-foreground">No greeting yet.</span>}
            </div>
            <p className="mt-6 text-muted-foreground text-sm">Variables in use</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
              {used.length ? used.map((n) => <VarChip key={n} name={n} empty={isEmpty(n)} />) : <span className="text-muted-foreground">None yet. Write {"{{name}}"} in your text.</span>}
            </div>
            {missing.length > 0 && (
              <button type="button" onClick={addMissing} className="mt-4 text-sm text-warning-foreground underline underline-offset-4">
                Add {missing.length} missing {missing.length === 1 ? "variable" : "variables"}
              </button>
            )}
          </div>
        </aside>
      </div>

      <div className="pointer-events-none sticky bottom-6 z-20 flex flex-col items-center gap-3">
        {review && (
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border bg-card p-4 shadow-black/10 shadow-xl">
            <p className="font-medium text-sm">{passed} of {checks.length} checks passed</p>
            <ul className="mt-3 space-y-2.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  {c.ok ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success-foreground" /> : <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-warning-foreground" />}
                  <span>
                    {c.label}
                    {!c.ok && <span className="block text-muted-foreground">{c.fix}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => setReview((r) => !r)}
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border bg-card px-5 py-2.5 text-[15px] shadow-black/10 shadow-lg transition-transform hover:-translate-y-0.5"
        >
          <ClipboardCheckIcon className="size-4" /> Review agent
        </button>
      </div>
    </form>
  );
}
