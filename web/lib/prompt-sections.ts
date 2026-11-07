// An agent's instructions are stored as plain text ("# Heading" followed by its lines).
// The builder shows them as separate blocks, so split and join them here.

export type Section = { id: number; title: string; body: string };

export function parseSections(prompt: string): Section[] {
  const text = prompt.replace(/\r\n/g, "\n").trim();
  if (!text) return [{ id: 0, title: "Instructions", body: "" }];
  const out: Omit<Section, "id">[] = [];
  let cur: Omit<Section, "id"> | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (m) {
      if (cur) out.push(cur);
      cur = { title: m[1], body: "" };
    } else {
      cur ??= { title: "Instructions", body: "" };
      cur.body += (cur.body ? "\n" : "") + line;
    }
  }
  if (cur) out.push(cur);
  return out.map((s, id) => ({ id, title: s.title, body: s.body.trim() }));
}

export function joinSections(sections: Section[]): string {
  return sections
    .filter((s) => s.title.trim() || s.body.trim())
    .map((s) => (s.title.trim() ? `# ${s.title.trim()}\n${s.body.trim()}` : s.body.trim()))
    .join("\n\n");
}

/** Lines of a block body, tagged for display: bullet, numbered or plain. */
export function bodyLines(body: string): { kind: "bullet" | "number" | "text"; text: string; n?: string }[] {
  return body
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const b = l.match(/^\s*[-*•]\s+(.*)$/);
      if (b) return { kind: "bullet" as const, text: b[1] };
      const n = l.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (n) return { kind: "number" as const, text: n[2], n: n[1] };
      return { kind: "text" as const, text: l.trim() };
    });
}
