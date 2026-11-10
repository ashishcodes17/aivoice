import {
  BanknoteIcon,
  BuildingIcon,
  CarIcon,
  FishIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  PackageIcon,
  PlaneIcon,
  ShieldIcon,
  ShoppingBagIcon,
  StethoscopeIcon,
  UtensilsIcon,
} from "lucide-react";

const ROW_A = [
  { icon: StethoscopeIcon, label: "Clinic appointments" },
  { icon: BanknoteIcon, label: "EMI reminders" },
  { icon: BuildingIcon, label: "Real estate site visits" },
  { icon: UtensilsIcon, label: "Table bookings" },
  { icon: GraduationCapIcon, label: "Admission enquiries" },
  { icon: ShieldIcon, label: "Insurance renewals" },
];
const ROW_B = [
  { icon: ShoppingBagIcon, label: "COD order confirmation" },
  { icon: FishIcon, label: "Hatchery sales calls" },
  { icon: HeartPulseIcon, label: "Lab report follow-ups" },
  { icon: PackageIcon, label: "Delivery rescheduling" },
  { icon: CarIcon, label: "Service reminders" },
  { icon: PlaneIcon, label: "Travel enquiries" },
];

function Row({ items, reverse }: { items: typeof ROW_A; reverse?: boolean }) {
  return (
    <div className="marquee flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="marquee-track flex shrink-0 gap-3 pr-3" data-reverse={reverse ? "" : undefined} style={{ ["--marquee-speed" as string]: "45s" }}>
        {[...items, ...items].map((it, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className="flex shrink-0 items-center gap-2.5 rounded-full border bg-card px-4 py-2 text-[15px] shadow-black/[0.03] shadow-sm"
          >
            <it.icon className="size-4 text-primary" />
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UseCases() {
  return (
    <section className="relative border-b bg-[#faf9fd] py-14">
      <p className="text-center font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
        Built for every business that lives on the phone
      </p>
      <div className="mt-7 space-y-3">
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </section>
  );
}
