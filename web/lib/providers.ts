// Which voice providers the product shows. The worker and the data still support every provider
// (Sarvam, ElevenLabs, Rumik, Smallest AI); for now only Gnani is offered in the interface.
export const VISIBLE_PROVIDERS = ["gnani"] as const;

export const isVisibleProvider = (p: string) => (VISIBLE_PROVIDERS as readonly string[]).includes(p);
