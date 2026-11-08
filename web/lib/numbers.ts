// Renting a phone number from the platform's VoiceLink inventory.

/** What the customer pays each month, in paise. The wallet is charged this, never a VoiceLink figure. */
export const NUMBER_PRICE_PAISE = 35000;
export const NUMBER_PRICE_LABEL = "₹350";

/** Purchases spend real money on VoiceLink, so they stay off until this is set to "true". */
export const purchasesEnabled = () => process.env.NUMBER_PURCHASE_ENABLED === "true";

/** The most one number may cost us on VoiceLink, in rupees. Above this we refuse, so rent never runs at a loss. */
export const maxProviderCostRupees = () => Number(process.env.NUMBER_MAX_PROVIDER_COST ?? 300);

export const PURCHASES_PER_ORG_PER_DAY = 3;
/** Days after a missed renewal before a number is released. */
export const GRACE_DAYS = 3;
