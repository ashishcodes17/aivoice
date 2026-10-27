import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Terminal events carry the final duration. `call.completed` also fires for failed calls.
const SETTLE_EVENTS = new Set(["call.ended", "call.completed", "call.failed"]);

const str = (v: unknown) => (v == null ? undefined : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// Real payloads nest the call under `call` (id, from, to, durationSec, ...); the public
// docs show a flat shape (callId, fromNumber, ...). Accept both.
function normalize(body: Record<string, unknown>) {
  const c = (body.call && typeof body.call === "object" ? body.call : body) as Record<string, unknown>;
  return {
    event: str(body.event) ?? "",
    callId: str(c.id ?? c.callId),
    from: str(c.from ?? c.fromNumber),
    to: str(c.to ?? c.toNumber),
    direction: str(c.direction)?.toLowerCase(),
    duration: Math.max(0, Math.round(num(c.durationSec ?? c.duration_sec ?? c.duration) ?? 0)),
    status: str(c.status ?? c.callStatus),
    hangup: str(c.hangupReason ?? c.hangupCause),
  };
}

// VoiceLink may send +91…, 0… or bare digits; match on the full digits and the last 10.
function didCandidates(...numbers: (string | undefined)[]) {
  const out = new Set<string>();
  for (const n of numbers) {
    const digits = (n ?? "").replace(/\D/g, "");
    if (digits) {
      out.add(digits);
      out.add(digits.slice(-10));
    }
  }
  return [...out];
}

const log = (msg: string, data: Record<string, unknown> = {}) =>
  console.log(`[voicelink-webhook] ${msg} ${JSON.stringify(data)}`);

// VoiceLink webhooks are unsigned, so the URL path carries a shared secret.
// Always answer 200 for events we understand, or VoiceLink retries.
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!process.env.VOICELINK_WEBHOOK_SECRET || secret !== process.env.VOICELINK_WEBHOOK_SECRET) {
    log("REJECTED bad secret", { ip: req.headers.get("x-forwarded-for") });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    log("REJECTED invalid JSON", { bytes: raw.length, head: raw.slice(0, 120) });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const e = normalize(body);
  log("RECEIVED", { ...e, shape: body.call ? "nested" : "flat", keys: Object.keys(body) });
  if (!e.callId) {
    log("IGNORED no call id", { keys: Object.keys(body) });
    return NextResponse.json({ ok: true, ignored: "no call id" });
  }

  const supabase = createAdminClient();

  // Mark the call answered as soon as VoiceLink says so (the worker creates the row).
  if (e.event === "call.answered") {
    await supabase.from("calls").update({ status: "answered" }).eq("voicelink_call_sid", e.callId);
    log("ANSWERED", { callId: e.callId });
    return NextResponse.json({ ok: true });
  }
  if (!SETTLE_EVENTS.has(e.event)) {
    log("NOTED no action for event", { event: e.event, callId: e.callId });
    return NextResponse.json({ ok: true });
  }

  // The org owns the DID: the callee on inbound calls, the caller on outbound ones.
  const side = e.direction === "outbound" ? [e.from] : e.direction === "inbound" ? [e.to] : [e.to, e.from];
  const { data: number } = await supabase
    .from("phone_numbers")
    .select("org_id, did_number")
    .in("did_number", didCandidates(...side))
    .limit(1)
    .maybeSingle();
  if (!number) {
    log("IGNORED unknown DID", { callId: e.callId, from: e.from, to: e.to, direction: e.direction });
    return NextResponse.json({ ok: true, ignored: "unknown DID" });
  }

  const { error } = await supabase.rpc("settle_call", {
    p_org: number.org_id,
    p_call_sid: e.callId,
    p_direction: e.direction === "outbound" ? "outbound" : "inbound",
    p_from: e.from ?? null,
    p_to: e.to ?? null,
    p_duration: e.duration,
    p_rate_paise_per_min: Number(process.env.CALL_RATE_PAISE_PER_MIN ?? 300),
  });
  if (error) {
    // 500 makes VoiceLink retry; settle_call is idempotent, so a retry cannot double-charge.
    log("ERROR settle_call failed", { callId: e.callId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const status = e.event === "call.failed" ? "failed" : e.event === "call.completed" ? "completed" : "ended";
  await supabase.from("calls").update({ status }).eq("voicelink_call_sid", e.callId);
  log("SETTLED", { callId: e.callId, did: number.did_number, seconds: e.duration, status, hangup: e.hangup });
  return NextResponse.json({ ok: true });
}
