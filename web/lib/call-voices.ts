// What a single requested call can be told to use, instead of the agent's own voice settings.
// The voice worker holds the actual voices and checks every choice again before using it
// (voice-worker/worker/voices.py), so keep these two lists in step.

export const CALL_LANGUAGES = [
  { value: "te-IN", label: "Telugu" },
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "Hindi" },
] as const;

export const CALL_PROVIDERS = [
  { value: "sarvam", label: "Sarvam" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "rumik", label: "Rumik" },
  { value: "smallest", label: "Smallest AI" },
  { value: "gnani", label: "Gnani" },
] as const;

export type CallLanguage = (typeof CALL_LANGUAGES)[number]["value"];
export type CallProvider = (typeof CALL_PROVIDERS)[number]["value"];

// Which providers speak which language well enough to offer. Filled in from tests of each pair.
export const SUPPORTED: Record<CallProvider, CallLanguage[]> = {
  sarvam: ["te-IN", "en-IN", "hi-IN"],
  elevenlabs: ["en-IN", "hi-IN"],
  rumik: ["en-IN", "hi-IN"],
  smallest: ["te-IN", "en-IN", "hi-IN"],
  gnani: ["te-IN", "en-IN", "hi-IN"],
};

export function isSupported(provider: string, language: string) {
  return (SUPPORTED[provider as CallProvider] as string[] | undefined)?.includes(language) ?? false;
}
