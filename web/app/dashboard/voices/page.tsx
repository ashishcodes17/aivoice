import { Suspense } from "react";
import { VoiceGallery } from "@/components/dashboard/voice-gallery";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { requireOrg } from "@/lib/dashboard";

export const metadata = { title: "Voices" };

export default function VoicesPage() {
  return (
    <Page>
      <PageHeader title="Voices" description="Listen to each voice as a caller would hear it, then pick the one that suits your agent." />
      <Suspense fallback={<PageFallback />}>
        <Gallery />
      </Suspense>
    </Page>
  );
}

async function Gallery() {
  const { supabase, org } = await requireOrg();
  const { data } = await supabase.from("agents").select("id, name, language, tts_provider, tts_voice").eq("org_id", org.id).order("created_at", { ascending: true });
  return <VoiceGallery agents={data ?? []} />;
}
