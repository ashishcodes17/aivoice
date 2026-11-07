import { InfoIcon } from "lucide-react";
import type { Block } from "@/lib/blog";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function headings(blocks: Block[]) {
  return blocks.filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2").map((b) => ({ id: slug(b.text), text: b.text }));
}

export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[17px] text-foreground/85 leading-8">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
            return (
              <h2 key={i} id={slug(b.text)} className="scroll-mt-24 pt-6 font-heading font-semibold text-2xl text-foreground tracking-[-0.02em]">
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-2 font-heading font-semibold text-foreground text-lg tracking-tight">
                {b.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-2 ps-6 marker:text-primary/60">
                {b.items.map((x) => <li key={x}>{x}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-2 ps-6 marker:font-medium marker:text-primary">
                {b.items.map((x) => <li key={x}>{x}</li>)}
              </ol>
            );
          case "callout":
            return (
              <aside key={i} className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-base leading-7">
                <InfoIcon className="mt-1 size-4 shrink-0 text-primary" />
                <p>
                  {b.title && <strong className="font-semibold text-foreground">{b.title}. </strong>}
                  {b.text}
                </p>
              </aside>
            );
          default:
            return <p key={i}>{b.text}</p>;
        }
      })}
    </div>
  );
}
