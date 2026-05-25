<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the NASA.ex platform. The following changes were made:

**New files:**
- `instrumentation-client.ts` — Initializes PostHog client-side for Next.js 16 (replaces the `useEffect`-based init). Uses `capture_exceptions: true` for automatic error tracking.
- `src/lib/posthog-server.ts` — Server-side PostHog client factory using `posthog-node`. Used by all API routes to send server-side events.

**Modified files:**
- `src/components/providers/posthog-provider.tsx` — Removed the duplicate `posthog.init()` call (now handled by `instrumentation-client.ts`). Kept `PHProvider` wrapper for React context compatibility.
- `src/app/(auth)/sign-up/signup-form.tsx` — Added `posthog.identify()` + `user_signed_up` capture on successful signup.
- `src/app/(auth)/sign-in/login-form.tsx` — Added `posthog.identify()` + `user_signed_in` capture on successful login.
- `src/app/(platform)/(tracking)/nasa-route/checkout/sucesso/authenticated-success-polling.tsx` — Added `course_purchase_confirmed` capture when polling detects a paid purchase.
- `src/app/api/external/new-lead/route.ts` — Added `lead_created` server-side event.
- `src/app/api/stripe/checkout/route.ts` — Added `stripe_checkout_initiated` server-side event.
- `src/app/api/stripe/webhook/route.ts` — Added `course_purchase_webhook_completed`, `stars_topup_purchased`, and `plan_purchased` server-side events.
- `src/app/api/checkout/course/route.ts` — Added `course_checkout_started` server-side event.
- `src/app/api/forge/generate-payment-link/route.ts` — Added `forge_payment_link_generated` server-side event.
- `src/app/api/forge/sign-contract/route.ts` — Added `contract_signed` server-side event.

**Packages installed:** `posthog-node`, `@posthog/ai`, `@opentelemetry/sdk-node`, `@opentelemetry/resources`

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created account via email | `src/app/(auth)/sign-up/signup-form.tsx` |
| `user_signed_in` | User successfully logged in via email | `src/app/(auth)/sign-in/login-form.tsx` |
| `lead_created` | New lead arrived via external form | `src/app/api/external/new-lead/route.ts` |
| `stripe_checkout_initiated` | Stripe Checkout Session created (plan or Stars top-up) | `src/app/api/stripe/checkout/route.ts` |
| `plan_purchased` | Plan purchase confirmed via Stripe webhook | `src/app/api/stripe/webhook/route.ts` |
| `stars_topup_purchased` | Stars top-up purchase confirmed via Stripe webhook | `src/app/api/stripe/webhook/route.ts` |
| `course_purchase_webhook_completed` | Course purchase finalized via Stripe webhook | `src/app/api/stripe/webhook/route.ts` |
| `course_checkout_started` | Public user started course checkout (Stripe session created) | `src/app/api/checkout/course/route.ts` |
| `course_purchase_confirmed` | Client polling detected PAID status after checkout | `src/app/(platform)/(tracking)/nasa-route/checkout/sucesso/authenticated-success-polling.tsx` |
| `forge_payment_link_generated` | Forge proposal payment link generated via gateway | `src/app/api/forge/generate-payment-link/route.ts` |
| `contract_signed` | Signer signed a Forge contract | `src/app/api/forge/sign-contract/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1627193)
- [New Signups (last 30 days)](/insights/8UvqYtoG)
- [New Leads Created (last 30 days)](/insights/XLjgGSbP)
- [Course Checkout Conversion Funnel](/insights/snXJOnYt)
- [Revenue Events (last 30 days)](/insights/GgXYlwKh)
- [Signup to Stripe Checkout Funnel](/insights/i6vFjhon)

---

## LLM Analytics

LLM analytics were added using the **Vercel AI SDK + OpenTelemetry** approach. All `$ai_generation` events are sent automatically to PostHog's OTLP endpoint whenever an instrumented AI call completes.

**New files:**
- `instrumentation.ts` (extended) — Added `PostHogSpanProcessor` from `@posthog/ai/otel` inside the `nodejs` runtime block. The OTel `NodeSDK` is initialized here and processes all `gen_ai.*` spans from Vercel AI SDK calls.

**Modified files (experimental_telemetry added):**
- `src/features/astro/server/orchestrator.ts` — ASTRO orchestrator `streamText` (main + pinned-agent paths) and `generateText` in sub-agent runner (OpenAI gpt-4o / gpt-4o-mini). `posthog_distinct_id` set to `ctx.userId`.
- `src/app/api/chat/route.ts` — General chat `streamText` (OpenAI gpt-4o-mini).
- `src/app/api/ai/extract-brand/route.ts` — Brand extraction `generateText` (Anthropic claude-haiku-4-5). `posthog_distinct_id` set to authenticated user ID.
- `src/app/api/ai/generate-guide/route.ts` — Integration guide `generateText` (Anthropic claude-haiku-4-5). `posthog_distinct_id` set to authenticated user ID.
- `src/app/router/ia/extract-budget.ts` — Budget extraction from PDF/image `generateObject` (Anthropic claude-haiku-4-5). `posthog_distinct_id` set to authenticated user ID.
- `src/app/router/ia/generate-compose.ts` — Message composer `streamText` (Google gemini-2.5-flash).
- `src/app/router/ia/generate-conversation-summary.ts` — Conversation summary `streamText` (Google gemini-2.5-flash).
- `src/app/api/public/booking-chat/route.ts` — Public booking assistant `streamText` (Google gemini-2.5-flash). Metadata includes `org_slug` and `agenda_slug`.

**Providers covered:** OpenAI, Anthropic, Google (all via Vercel AI SDK)

Every instrumented call will produce a `$ai_generation` event in PostHog's [LLM Analytics → Generations](/llm-analytics/generations) view with properties including `$ai_model`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_latency`, `$ai_total_cost_usd`, and more.

### Agent skill

We've left agent skill folders in your project at `.claude/skills/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
