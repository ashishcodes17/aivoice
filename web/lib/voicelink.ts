const BASE = "https://app.voicelink.co.in/api/v1";

type PlaceCallResult = { ok: true; queueId?: number } | { ok: false; error: string };

// Env values are easy to damage when pasted: stray quotes, spaces, a newline, or the whole
// `NAME=value` line. Undo those so a good token does not fail for cosmetic reasons.
function cleanToken(raw: string | undefined) {
  return raw?.trim().replace(/^VOICELINK_API_TOKEN\s*=\s*/, "").replace(/^["']+|["']+$/g, "").trim();
}

// Asks VoiceLink to dial `customerNumber` from `did` and connect the call to the DID's outbound
// WebSocket bot (our worker). `params` travels with the call and returns on the worker's `start`
// frame and on webhooks. Dials a real number and uses balance, so callers must validate first.
export async function placeCall(args: {
  did: string;
  customerNumber: string;
  params: Record<string, unknown>;
}): Promise<PlaceCallResult> {
  const token = cleanToken(process.env.VOICELINK_API_TOKEN);
  if (!token) return { ok: false, error: "Calling is not set up yet. Ask the platform admin to configure it." };

  try {
    const res = await fetch(`${BASE}/add_lead`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        did_number: args.did,
        customer_number: args.customerNumber,
        country_code: "91",
        // The API wants this as a JSON string, not an object.
        custom_parameters: JSON.stringify(args.params),
        // Deliberately no `call_limit`: VoiceLink documents it only as "maximum call limit for all
        // leads", and sending 1 ended every answered call exactly one second after pickup.
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      errors?: Record<string, string[]>;
      data?: { outbound_queue_id?: number };
    };
    if (!res.ok || body.status === false) {
      const detail = body.errors ? Object.values(body.errors).flat().join(" ") : body.message;
      // The shape of the token (never its value) shows a truncated or mangled copy at a glance.
      const tokenShape = { length: token.length, hasPipe: token.includes("|") };
      console.log("[voicelink] add_lead failed", JSON.stringify({ http: res.status, message: body.message, errors: body.errors, tokenShape }));
      if (res.status === 401) {
        return { ok: false, error: "The phone provider did not accept our login. The VoiceLink token on the server needs to be re-entered." };
      }
      return { ok: false, error: detail || `The phone provider refused the call (HTTP ${res.status}).` };
    }
    console.log("[voicelink] add_lead accepted", JSON.stringify({ did: args.did, queueId: body.data?.outbound_queue_id }));
    return { ok: true, queueId: body.data?.outbound_queue_id };
  } catch (e) {
    console.log("[voicelink] add_lead error", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Could not reach the phone provider. Please try again." };
  }
}

// ---- Phone number inventory (reseller purchase flow) ------------------------------------------

type Json = Record<string, unknown>;

async function call(path: string, init: { method?: "GET" | "POST"; query?: Record<string, string>; body?: Json } = {}): Promise<{ ok: true; data: Json } | { ok: false; error: string }> {
  const token = cleanToken(process.env.VOICELINK_API_TOKEN);
  if (!token) return { ok: false, error: "Phone numbers are not set up yet." };
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Json & { status?: boolean; message?: string; errors?: Record<string, string[]> };
    if (!res.ok || body.status === false) {
      const detail = body.errors ? Object.values(body.errors).flat().join(" ") : body.message;
      console.log("[voicelink]", path, "failed", JSON.stringify({ http: res.status, message: body.message, errors: body.errors }));
      return { ok: false, error: detail || `The phone provider refused the request (HTTP ${res.status}).` };
    }
    return { ok: true, data: body };
  } catch (e) {
    console.log("[voicelink]", path, "error", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Could not reach the phone provider. Please try again." };
  }
}

export type AvailableNumber = { id: number; did: string };

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// A short cache: the page asks on every visit, and the inventory does not change by the second.
const cache = new Map<string, { at: number; value: AvailableNumber[] }>();

/** Mobile numbers on offer, newest query first. Only id and number are returned; cost is never exposed. */
export async function listAvailableNumbers(search: string, perPage = 12): Promise<{ ok: true; numbers: AvailableNumber[] } | { ok: false; error: string }> {
  const q = digits(search).slice(0, 10);
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < 60_000) return { ok: true, numbers: hit.value };
  const r = await call("/reseller/purchase/dids", { query: { country_code: "+91", type: "2", months: "1", per_page: String(perPage), ...(q ? { number: q } : {}) } });
  if (!r.ok) return r;
  const rows = ((r.data.data as Json | undefined)?.data ?? r.data.data ?? []) as Json[];
  const numbers = (Array.isArray(rows) ? rows : []).map((d) => ({ id: Number(d.id), did: digits(d.did_number) })).filter((d) => Number.isInteger(d.id) && d.did.length >= 10);
  cache.set(q, { at: Date.now(), value: numbers });
  return { ok: true, numbers };
}

export type BoughtNumber = { didNumber: string; voicelinkDidId: number };
export type BuyResult =
  | { ok: true; number: BoughtNumber }
  // Nothing was bought, so the customer can be refunded in full.
  | { ok: false; stage: "before_purchase"; error: string }
  // The number was bought but could not be wired to our bot: a person must finish it.
  | { ok: false; stage: "after_purchase"; error: string; didNumber: string; voicelinkDidId: number | null };

/**
 * Buys one number for one month and points it at our voice bot. SPENDS REAL MONEY on the reseller
 * wallet. Callers must have taken the customer's payment first and must refund on "before_purchase".
 */
export async function buyNumber(voicelinkDidId: number, expectedDid: string, maxCostRupees: number): Promise<BuyResult> {
  const botIn = Number(process.env.VOICELINK_INBOUND_BOT_ID);
  const botOut = Number(process.env.VOICELINK_OUTBOUND_BOT_ID || process.env.VOICELINK_INBOUND_BOT_ID);
  if (!Number.isInteger(botIn) || !Number.isInteger(botOut)) return { ok: false, stage: "before_purchase", error: "Number purchase is not configured yet." };

  const lock = await call("/reseller/purchase/lock-did", { method: "POST", body: { did_ids: [voicelinkDidId], months: 1 } });
  if (!lock.ok) return { ok: false, stage: "before_purchase", error: lock.error };
  const orderId = Number((lock.data.data as Json | undefined)?.order_id);
  if (!Number.isInteger(orderId)) return { ok: false, stage: "before_purchase", error: "The phone provider did not start an order." };

  // The server-side total is the only price we trust. Refuse anything dearer than we allow.
  const summary = await call(`/reseller/purchase/summary/${orderId}`);
  if (!summary.ok) return { ok: false, stage: "before_purchase", error: summary.error };
  const total = Number((summary.data.data as Json | undefined)?.total);
  if (!Number.isFinite(total) || total <= 0 || total > maxCostRupees) {
    console.log("[voicelink] purchase refused on price", JSON.stringify({ orderId, total, maxCostRupees }));
    return { ok: false, stage: "before_purchase", error: "That number is not available right now. Please pick another." };
  }

  const confirm = await call("/reseller/purchase/confirm", { method: "POST", body: { order_id: orderId } });
  if (!confirm.ok) return { ok: false, stage: "before_purchase", error: confirm.error };

  // From here on the number is ours and paid for.
  const owned = await call("/reseller/did/purchased", { query: { per_page: "20", search: digits(expectedDid).slice(-10) } });
  const list = owned.ok ? ((((owned.data.data as Json | undefined)?.data ?? owned.data.data ?? []) as Json[]) ?? []) : [];
  const found = (Array.isArray(list) ? list : []).find((d) => Number(d.id) === voicelinkDidId);
  const didNumber = digits(found?.did_number);
  if (!found || didNumber.length < 10) {
    return { ok: false, stage: "after_purchase", error: "Bought, but the number could not be read back from the provider.", didNumber: "", voicelinkDidId };
  }

  const route = await call("/call-routing/create", {
    method: "POST",
    body: { did_id: voicelinkDidId, status: 1, for_inbound_call: 3, inbound_websocket_bot_id: botIn, for_outbound_call: 3, outbound_websocket_bot_id: botOut },
  });
  if (!route.ok) return { ok: false, stage: "after_purchase", error: `Bought, but routing failed: ${route.error}`, didNumber, voicelinkDidId };
  return { ok: true, number: { didNumber, voicelinkDidId } };
}

/** Gives a rented number back to VoiceLink. Returns true only when the provider confirms it. */
export async function releaseNumber(didNumber: string): Promise<boolean> {
  const d = digits(didNumber);
  const r = await call("/reseller/did/release", { method: "POST", body: { did_number: d } });
  if (!r.ok) return false;
  const released = ((r.data.data as Json | undefined)?.released_did_numbers ?? []) as unknown[];
  return Array.isArray(released) && released.map(digits).includes(d);
}
