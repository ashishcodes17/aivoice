import type { Metadata } from "next";
import { Geist_Mono, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const heading = Inter({ subsets: ["latin"], variable: "--font-heading" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://app.lynksy.xyz"),
  title: {
    default: "Lynksy: AI voice agents for phone calls in Indian languages",
    template: "%s | Lynksy",
  },
  description:
    "Build voice agents that answer and place phone calls on Indian numbers, in Hindi, Tamil, Telugu and more. Pay per minute in rupees.",
  openGraph: {
    title: "Lynksy: AI voice agents for phone calls in Indian languages",
    description:
      "Voice agents that answer and place phone calls on Indian numbers, in the language your callers speak.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full scroll-smooth antialiased",
        sans.variable,
        heading.variable,
        serif.variable,
        mono.variable,
      )}
    >
      <body className="relative min-h-full font-sans">
        {/* Base UI portals (dialogs, menus) layer above this isolated root. */}
        <div className="isolate relative flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
