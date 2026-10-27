import Razorpay from "razorpay";

let client: Razorpay | undefined;

// Created on first use so `next build` works without payment keys configured.
export function getRazorpay(): Razorpay {
  client ??= new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  return client;
}
