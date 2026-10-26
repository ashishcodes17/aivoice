import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";

const Body = z.object({
  orgId: z.string().uuid(),
  amountRupees: z.number().int().min(100).max(100000),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { orgId, amountRupees } = parsed.data;

  // RLS on `members` confirms the caller belongs to this org.
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership } = await supabase
    .from("members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const amountPaise = amountRupees * 100;
  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    notes: { org_id: orgId },
  });

  const { error } = await createAdminClient()
    .from("payments")
    .insert({ org_id: orgId, razorpay_order_id: order.id, amount_paise: amountPaise });
  if (error) return NextResponse.json({ error: "Could not record order" }, { status: 500 });

  return NextResponse.json({ orderId: order.id, amount: amountPaise, keyId: process.env.RAZORPAY_KEY_ID });
}
