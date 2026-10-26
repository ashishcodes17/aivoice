# AI Voice Calling Platform: Status and Plan

_Last updated: 2026-10-26_

## Stack (decided)

| Layer | Choice |
|---|---|
| Web app | Next.js 16 + TypeScript, `app/` layout (no `src/`), Tailwind 4 |
| Database / auth | Supabase (Postgres, Auth, RLS), local via Docker, self-hosted on VPS later |
| Payments | Razorpay (prepaid wallet top-ups) |
| Telephony | VoiceLink (Elision): WebSocket media streaming, Indian DIDs |
| Voice worker | Python 3.12 + Pipecat + FastAPI (managed with `uv`) |
| STT | Sarvam |
| LLM | OpenRouter (no Claude for now) |
| TTS | Sarvam and ElevenLabs |
| Hosting | 2 VPS: web + DB on one, voice worker on the other |

**Not used:** LiveKit, MongoDB.

## Repo layout

```
aivoice/
├── PLAN.md
├── web/            Next.js app + Supabase config and migrations
│   ├── app/api/razorpay/{order,webhook}
│   ├── app/api/voicelink/webhook/[secret]
│   ├── lib/supabase/{server,browser,admin}.ts
│   └── supabase/migrations/{0001_init,0002_call_settlement}.sql
└── voice-worker/   Python Pipecat worker (dependencies installing)
```

## Done

- [x] Next.js + TypeScript scaffold, moved to the root `app/` layout, typechecks clean
- [x] Packages: Supabase, Razorpay, zod, TanStack Query, lucide, shadcn utilities
- [x] LiveKit packages removed
- [x] Schema: orgs, members, agents, phone numbers, campaigns, calls, transcripts, wallet ledger, payments
- [x] Row Level Security on all tables, keyed on org membership
- [x] Razorpay: create order (checks org membership) and webhook (HMAC verified, idempotent credit)
- [x] VoiceLink webhook: debits the wallet on `call.ended`, one debit per call enforced by the DB
- [x] Supabase client helpers and `.env.example`
- [x] `supabase init` done, project id `aivoice`
- [x] Next.js dev server runs at http://localhost:3000
- [x] VoiceLink API and WebSocket protocol reviewed (A-law, 8 kHz, mono; events `connected/start/media/mark/clear/transfer/stop`)

## Pending

### Blocked on you
- [ ] **Install Docker Desktop or OrbStack and start it** (`docker ps` must work). Local Supabase can't start without it.
- [ ] Provide API keys for `.env.local`: OpenRouter, Sarvam, ElevenLabs, Razorpay (test mode), VoiceLink token
- [ ] Confirm VoiceLink account type (reseller or client) and that a DID plus a WebSocket bot is available

### Me, once Docker is up
- [ ] `npx supabase start`, then `npx supabase db reset` to apply both migrations
- [ ] Write the local Supabase URL and keys into `web/.env.local`
- [ ] Generate TypeScript DB types (`supabase gen types`)

### Me, once the Python install finishes
(`uv add` is still running; the venv is empty)
- [ ] FastAPI WebSocket endpoint for VoiceLink
- [ ] A-law 8 kHz ↔ PCM serializer for Pipecat
- [ ] Pipeline: Sarvam STT → OpenRouter LLM → Sarvam or ElevenLabs TTS, with barge-in via the `clear` event
- [ ] Load the agent config (prompt, voice, language) from Supabase by dialed DID
- [ ] Save transcripts to `call_transcripts`
- [ ] Outbound calls: wrapper for VoiceLink `POST /add_lead`

### Web app (next build phase)
- [ ] Auth pages (Supabase Auth), org creation via `create_organization`
- [ ] Dashboard: agents CRUD, phone numbers, call logs and transcripts
- [ ] Wallet page: balance and Razorpay Checkout top-up
- [ ] Campaigns: upload leads, start outbound calls
- [ ] Middleware for session refresh

### Before production
- [ ] Self-host Supabase on VPS 1; run the worker on VPS 2 behind TLS (`wss://` is required by VoiceLink)
- [ ] GST invoice generation
- [ ] DLT/TRAI registration for outbound calling
- [ ] Partition `calls` and `call_transcripts` by month once volume grows
- [ ] Rate limiting and monitoring

## Known risks and open questions

1. **DID format mismatch:** the VoiceLink webhook may send numbers in a different format (leading `0` or `91`) than `phone_numbers.did_number`. Check on the first real call.
2. **Webhook auth:** VoiceLink does not sign webhooks. We rely on a secret in the URL path. Ask them whether signing exists.
3. **Docs gaps:** the `transfer` event direction and `client_id` requirement when a reseller creates a bot are ambiguous in VoiceLink's docs.
4. **Latency:** an 8 kHz telephony stream plus a remote LLM and TTS needs measuring. Target is under 800 ms per turn.
5. **Python install is slow:** Pipecat pulls many dependencies. If it keeps hanging, I'll restart it.

## Order of work

1. Docker running → local Supabase + migrations
2. Voice worker end to end with one inbound test call
3. Dashboard and auth
4. Wallet top-up and billing check
5. Outbound campaigns
6. Deploy to the 2 VPS
