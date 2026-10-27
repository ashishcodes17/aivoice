// What customers pay. Keep in step with CALL_RATE_PAISE_PER_MIN (300 paise), which is what the
// wallet is actually charged per started minute.
export const RATE_INR_PER_MINUTE = 3;

export const inrWhole = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const number = (n: number) => new Intl.NumberFormat("en-IN").format(n);
