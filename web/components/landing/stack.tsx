// Providers the platform actually runs on. Names only, no logos.
const STACK = [
  { name: "Sarvam AI", role: "Indian speech and voices" },
  { name: "ElevenLabs", role: "Expressive voices" },
  { name: "Gnani", role: "Backup speech engine" },
  { name: "OpenRouter", role: "Hundreds of LLMs" },
  { name: "WhatsApp", role: "Messages and voice notes" },
  { name: "UPI", role: "Wallet top-ups" },
];

export function Stack() {
  return (
    <section className="border-y bg-[#faf9fd] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          Runs on the best of Indian and global voice AI
        </p>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {STACK.map((s) => (
            <div key={s.name} className="bg-card px-4 py-5 text-center transition-colors hover:bg-background">
              <p className="font-heading font-semibold text-[15px] tracking-tight">{s.name}</p>
              <p className="mt-1 text-muted-foreground text-xs">{s.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
