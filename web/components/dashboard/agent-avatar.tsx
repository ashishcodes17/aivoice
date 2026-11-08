import { cn } from "@/lib/utils";

// Every agent gets its own gradient blob, worked out from its id so it never changes and two agents rarely match.
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function AgentAvatar({ seed, className }: { seed: string; className?: string }) {
  const h = hash(seed || "agent");
  const hue = h % 360;
  const spread = 50 + ((h >> 9) % 70); // how far the other colours sit from the first
  const c = (offset: number, l = 62) => `hsl(${(hue + offset) % 360} 85% ${l}%)`;
  const pos = (shift: number) => ({ left: `${((h >> shift) % 50) - 10}%`, top: `${((h >> (shift + 3)) % 50) - 10}%` });

  const blobs = [
    { color: c(0), size: "80%", ...pos(2), dx: "14%", dy: "-12%", dur: "9s" },
    { color: c(spread, 66), size: "70%", ...pos(5), dx: "-16%", dy: "10%", dur: "11s" },
    { color: c(-spread, 70), size: "60%", ...pos(8), dx: "10%", dy: "14%", dur: "13s" },
  ];

  return (
    <span aria-hidden className={cn("relative isolate inline-block size-10 shrink-0 overflow-hidden rounded-full", className)} style={{ background: c(spread / 2, 78) }}>
      {blobs.map((b, i) => (
        <span
          key={i}
          className="agent-blob absolute rounded-full opacity-90 blur-[10px]"
          style={{ width: b.size, height: b.size, left: b.left, top: b.top, background: b.color, ["--bx" as string]: b.dx, ["--by" as string]: b.dy, ["--bd" as string]: b.dur }}
        />
      ))}
      <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/35 via-transparent to-transparent ring-1 ring-black/5 ring-inset" />
    </span>
  );
}
