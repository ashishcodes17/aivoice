import { Reveal } from "./reveal";

const GREETINGS = [
  { word: "नमस्ते", lang: "Hindi" },
  { word: "வணக்கம்", lang: "Tamil" },
  { word: "నమస్కారం", lang: "Telugu" },
  { word: "নমস্কার", lang: "Bengali" },
  { word: "ನಮಸ್ಕಾರ", lang: "Kannada" },
];

const LANGS = ["हिन्दी", "English", "தமிழ்", "తెలుగు", "বাংলা", "मराठी", "ಕನ್ನಡ", "മലയാളം", "ગુજરાતી", "ਪੰਜਾਬੀ", "ଓଡ଼ିଆ"];
const NAMES = ["Hindi", "English", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Odia", "Hinglish"];

export function Languages() {
  const cycle = GREETINGS.length * 3;
  return (
    <section id="languages" className="relative scroll-mt-20 overflow-hidden bg-[#07061a] py-24 text-white sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora-b absolute top-[-30%] left-[20%] size-[40rem] rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.35),transparent_62%)] blur-3xl" />
        <div className="aurora-a absolute right-[-10%] bottom-[-30%] size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(249_115_82/0.22),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <p className="font-medium text-indigo-200/70 text-xs uppercase tracking-[0.18em]">Languages</p>
        <h2 className="mx-auto mt-5 max-w-3xl text-balance font-heading font-semibold text-3xl tracking-[-0.03em] sm:text-5xl">
          Your agent says hello the way your callers do.
        </h2>

        <div className="relative mx-auto mt-14 h-28 max-w-3xl sm:h-36" aria-label="Namaste, Vanakkam, Namaskaram, Nomoskar, Namaskara">
          {GREETINGS.map((g, i) => (
            <div
              key={g.lang}
              aria-hidden
              className="word-cycle absolute inset-0 flex flex-col items-center justify-center"
              style={{ animationDelay: `${i * 3}s`, ["--cycle" as string]: `${cycle}s` }}
            >
              <span className="bg-[linear-gradient(180deg,#fff,rgb(199_210_254/0.7))] bg-clip-text font-semibold text-6xl text-transparent sm:text-8xl">
                {g.word}
              </span>
              <span className="mt-3 text-sm text-white/45">{g.lang}</span>
            </div>
          ))}
        </div>

        <Reveal className="mx-auto mt-14 max-w-xl text-pretty text-white/60 leading-7">
          Speech recognition and voices built for Indian languages. Callers can switch mid-sentence, like
          <span className="text-white"> &ldquo;kal shaam ka appointment chahiye&rdquo;</span>, and the agent keeps up.
        </Reveal>
      </div>

      <div className="relative mt-14 space-y-4">
        {[LANGS, NAMES].map((row, r) => (
          <div key={r} className="marquee flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <div
              className="marquee-track flex shrink-0 gap-4 pr-4"
              data-reverse={r ? "" : undefined}
              style={{ ["--marquee-speed" as string]: r ? "55s" : "40s" }}
            >
              {[...row, ...row].map((l, i) => (
                <span
                  key={i}
                  aria-hidden={i >= row.length}
                  className={
                    r
                      ? "shrink-0 rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/55"
                      : "shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-2xl text-white/85 backdrop-blur"
                  }
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
