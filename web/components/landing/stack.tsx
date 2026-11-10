// Providers the platform runs on. Names only, no logos. Other speech providers are supported by the
// worker but are not shown for now; the product is presented as powered by Gnani AI.
const STACK = [
  { name: "Gnani AI", role: "Speech recognition and voices" },
  { name: "OpenRouter", role: "Hundreds of LLMs" },
  { name: "VoiceLink", role: "Indian phone numbers" },
  { name: "Razorpay", role: "Wallet top-ups" },
];

export function Stack() {
  return (
    <section className="border-y bg-[#faf9fd] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          Powered by Gnani AI
        </p>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
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
