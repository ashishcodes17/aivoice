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
  { value: "bulbul:v3", label: "Sarvam Bulbul v3" },
  { value: "bulbul:v4-flash", label: "Sarvam Bulbul v4 Flash" },
  { value: "mulberry", label: "Rumik Mulberry (Hindi, English)" },
  { value: "muga", label: "Rumik Muga (Hindi, English)" },
  { value: "lightning_v3.1_pro", label: "Smallest Lightning v3.1 Pro" },
];

export const TTS_PROVIDERS = [
  { value: "sarvam", label: "Sarvam" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "rumik", label: "Rumik" },
  { value: "smallest", label: "Smallest AI" },
];
