import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const Event = z.object({
  event: z.string(),
  callId: z.string(),
  fromNumber: z.string().optional(),
  toNumber: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]),
  duration: z.number().optional(),
  customParameters: z.record(z.string(), z.unknown()).optional(),
});

// VoiceLink webhooks are unsigned, so the URL path carries a shared secret.
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (secret !== process.env.VOICELINK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Event.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const e = parsed.data;

  // Only call.ended carries the final duration; the other events need no action yet.
  if (e.event !== "call.ended") return NextResponse.json({ ok: true });

  // The org owns the DID: the callee for inbound calls, the caller for outbound.
  const did = e.direction === "inbound" ? e.toNumber : e.fromNumber;
  const supabase = createAdminClient();
  const { data: number } = await supabase
    .from("phone_numbers")
    .select("org_id")
    .eq("did_number", did ?? "")
    .maybeSingle();
  if (!number) return NextResponse.json({ ok: true, ignored: "unknown DID" });

  const { error } = await supabase.rpc("settle_call", {
    p_org: number.org_id,
    p_call_sid: e.callId,
    p_direction: e.direction,
    p_from: e.fromNumber ?? null,
    p_to: e.toNumber ?? null,
    p_duration: Math.round(e.duration ?? 0),
    p_rate_paise_per_min: Number(process.env.CALL_RATE_PAISE_PER_MIN ?? 300),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
