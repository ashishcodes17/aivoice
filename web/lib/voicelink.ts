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
        call_limit: 1,
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
