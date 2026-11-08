import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseNumber } from "@/lib/voicelink";
import { GRACE_DAYS } from "@/lib/numbers";

// Run once a day (any scheduler that can send a GET with a header), for example:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/number-renewals
//
// For each rented number whose month is up:
//   - cancelled by the customer: give it back to the provider and remove it,
//   - otherwise take the next month's rent from the wallet,
//   - if the wallet cannot cover it: start a grace period, and only after that release the number.
// Releasing a number is irreversible, so it only happens when NUMBER_RELEASE_ON_LAPSE=true.

const log = (msg: string, data: Record<string, unknown> = {}) => console.log(`[number-renewals] ${msg} ${JSON.stringify(data)}`);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const release = process.env.NUMBER_RELEASE_ON_LAPSE === "true";
  const { data: due, error } = await admin
    .from("phone_numbers")
    .select("id, org_id, did_number, cancel_at_period_end, grace_until, renews_at")
    .eq("source", "purchased")
    .lte("renews_at", new Date().toISOString())
    .limit(200);
  if (error) {
    log("ERROR listing", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = { renewed: 0, cancelled: 0, grace: 0, released: 0, kept: 0, failed: 0 };

  async function giveBack(n: { id: string; org_id: string; did_number: string }, why: string) {
    if (!release) {
      log("WOULD RELEASE (NUMBER_RELEASE_ON_LAPSE is off)", { did: n.did_number, why });
      result.kept++;
      return;
    }
    // Only remove our record once the provider confirms it has the number back.
    if (!(await releaseNumber(n.did_number))) {
      log("ERROR release not confirmed", { did: n.did_number });
      result.failed++;
      return;
    }
    await admin.from("phone_numbers").delete().eq("id", n.id);
    await admin.from("number_purchases").update({ status: "released", updated_at: new Date().toISOString() }).eq("did_number", n.did_number).eq("status", "active");
    log("RELEASED", { did: n.did_number, why });
    result.released++;
  }

  for (const n of due ?? []) {
    try {
      if (n.cancel_at_period_end) {
        await giveBack(n, "cancelled by customer");
        if (release) result.cancelled++;
        continue;
      }
      const { data: outcome, error: rpcError } = await admin.rpc("renew_number", { p_number: n.id });
      if (rpcError) throw new Error(rpcError.message);
      if (outcome === "renewed") {
        result.renewed++;
        continue;
      }
      if (outcome !== "insufficient") continue;

      // Wallet too low: a few days of grace, then give the number back.
      const grace = n.grace_until ? new Date(n.grace_until) : null;
      if (!grace) {
        const until = new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString();
        await admin.from("phone_numbers").update({ grace_until: until }).eq("id", n.id);
        log("GRACE started", { did: n.did_number, until });
        result.grace++;
      } else if (grace.getTime() <= Date.now()) {
        await giveBack(n, "unpaid after grace period");
      } else {
        result.grace++;
      }
    } catch (e) {
      log("ERROR number failed", { did: n.did_number, error: e instanceof Error ? e.message : String(e) });
      result.failed++;
    }
  }
  log("DONE", { due: due?.length ?? 0, ...result });
  return NextResponse.json({ ok: true, ...result });
}
