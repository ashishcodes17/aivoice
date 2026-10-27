// Language codes understood by the voice worker (Sarvam / Pipecat `Language`).
export const LANGUAGES = [
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "bn-IN", label: "Bengali" },
  { value: "ta-IN", label: "Tamil" },
  { value: "te-IN", label: "Telugu" },
  { value: "kn-IN", label: "Kannada" },
  { value: "ml-IN", label: "Malayalam" },
  { value: "mr-IN", label: "Marathi" },
  { value: "gu-IN", label: "Gujarati" },
  { value: "pa-IN", label: "Punjabi" },
  { value: "od-IN", label: "Odia" },
];

export const STT_PROVIDERS = [
  { value: "sarvam", label: "Sarvam" },
  { value: "elevenlabs", label: "ElevenLabs" },
];

export const SARVAM_TTS_MODELS = [
  { value: "bulbul:v3", label: "Bulbul v3" },
  { value: "bulbul:v4-flash", label: "Bulbul v4 Flash" },
];

export const TTS_PROVIDERS = [
  { value: "sarvam", label: "Sarvam" },
  { value: "elevenlabs", label: "ElevenLabs" },
];
