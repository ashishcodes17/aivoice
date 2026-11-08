// The shared test line. Every account can have its agent ring their own phone from this number,
// paid from the free test credit. It is never stored in phone_numbers, so no account owns it.

export const TEST_DID = (process.env.TEST_DID_NUMBER ?? "919429490400").replace(/\D/g, "");
export const TEST_DID_DISPLAY = "+91 94294 90400";
export const TEST_NUMBER_ID = "test";

/** Free credit given to every account, in paise. Must match grant_test_credit() in the database. */
export const TEST_CREDIT_PAISE = 2000;

// Test calls ring real phones from a number everyone shares, so the limits are tight.
export const TEST_LIMITS = {
  perOrgPerHour: 3,
  perOrgPerDay: 10,
  perDestinationPerDay: 5,
  destinationsPerOrgPerDay: 2, // an account may test on at most two different phones a day
  cooldownMs: 60_000,
  platformPerDay: Number(process.env.TEST_CALLS_PLATFORM_PER_DAY ?? 300),
} as const;

/** True for the shared test line, in any format (+91…, 0…, bare digits). */
export const isTestDid = (did: string) => did.replace(/\D/g, "").slice(-10) === TEST_DID.slice(-10);
