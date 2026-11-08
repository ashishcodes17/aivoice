// VoiceLink dials the national number with the country code supplied separately; a number with
// the country code baked in fails with cause 38 ("Network out of order"). So reduce to 10 digits.
export function parseIndianMobile(input: string): { national: string } | { error: string } {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return { error: "Enter a valid 10-digit Indian mobile number." };
  return { national: digits };
}

/** 919876543210 -> "+91 98765 43210". Anything else is shown as +digits. */
export function formatDid(did: string): string {
  const d = did.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`;
}
