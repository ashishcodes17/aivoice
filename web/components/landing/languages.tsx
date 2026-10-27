import { Badge } from "@/components/ui/badge";
import { Accent, Section, SectionHeading } from "./section";

const languages = [
  "हिन्दी",
  "English",
  "தமிழ்",
  "తెలుగు",
  "বাংলা",
  "मराठी",
  "ಕನ್ನಡ",
  "മലയാളം",
  "ગુજરાતી",
  "ਪੰਜਾਬੀ",
  "ଓଡ଼ିଆ",
];

export function Languages() {
  return (
    <Section id="languages" className="border-y bg-muted/30">
      <SectionHeading
        align="center"
        eyebrow="Languages"
        title={
          <>
            Speak the language your callers <Accent>already</Accent> do.
          </>
        }
        description="Speech recognition and voices built for Indian languages, so your agent sounds right on the first ring."
      />
      <div className="mx-auto mt-12 flex max-w-3xl flex-wrap justify-center gap-3">
        {languages.map((l) => (
          <Badge
            key={l}
            variant="outline"
            size="lg"
            className="h-9 rounded-full bg-card px-5 text-base sm:h-9 sm:text-base"
          >
            {l}
          </Badge>
        ))}
      </div>
    </Section>
  );
}
