/**
 * POST /api/stripe/checkout
 *
 * Cria uma Stripe Checkout Session para compras one-shot de Stars top-up.
 * Subscriptions de plano NÃO passam mais por aqui — vivem no fluxo do
 * better-auth (`authClient.subscription.upgrade()` / `billingPortal()`).
 * Detalhes em [docs/subscription-org-model.md].
 *
 * Body: { priceId, mode="payment", itemType="topup", itemSlug, cancelPath? }
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";
import { getPostHogClient } from "@/lib/posthog-server";

const BodySchema = z.object({
  priceId:    z.string(),
  mode:       z.literal("payment"),
  itemType:   z.literal("topup"),
  itemSlug:   z.string(),
  cancelPath: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // ── Org (active organization from session) ──────────────────────────────────
  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    return NextResponse.json({ error: "Nenhuma organização ativa." }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: activeOrgId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 404 });
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  const body = BodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Dados inválidos.", details: body.error.issues }, { status: 422 });
  }

  const { priceId, mode, itemType, itemSlug, cancelPath } = body.data;

  // ── Build URLs ──────────────────────────────────────────────────────────────
  const origin = req.nextUrl.origin;
  const successUrl = `${origin}/integrations?topup=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${cancelPath ?? "/integrations"}`;

  // ── Create session ──────────────────────────────────────────────────────────
  try {
    const { url, sessionId } = await createCheckoutSession({
      priceId,
      mode,
      successUrl,
      cancelUrl,
      organizationId: org.id,
      itemType,
      itemSlug,
      customerEmail: session.user.email,
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: session.user.id,
      event: "stripe_checkout_initiated",
      properties: {
        item_type: itemType,
        item_slug: itemSlug,
        mode,
        organization_id: org.id,
        stripe_session_id: sessionId,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({ url, sessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno.";
    // Stripe not configured: return a friendly error for dev environments
    if (msg.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Gateway de pagamento não configurado. Contate o suporte." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
