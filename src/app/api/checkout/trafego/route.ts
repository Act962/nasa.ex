/**
 * POST /api/checkout/trafego
 *
 * Endpoint PÚBLICO (sem auth) — usado pelo wizard em `/trafego`. O visitante
 * só precisa do e-mail; a conta é criada depois, no resgate.
 *
 * Fluxo:
 *  1. Valida o plano e a coerência do que veio do browser (plataforma, tipo e
 *     objetivo precisam existir no plano — o body é do cliente, não confiável).
 *  2. Idempotência: reusa `TrafegoPendingPurchase` PENDING < 30 min com
 *     (email, planId, objective) e a própria sessão Stripe, se ainda aberta.
 *  3. Cria a pending com o preço decomposto.
 *  4. Cria a Checkout Session com DOIS line_items — verba e taxa de serviço —
 *     para que a composição fique visível na tela de pagamento.
 *  5. Persiste o id da sessão e devolve a URL.
 *
 * Body: ver `trafegoCheckoutBodySchema`.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { computeTrafegoPrice, STRIPE_MIN_BRL_CENTS } from "@/features/trafego/lib/pricing";
import { trafegoCheckoutBodySchema } from "@/features/trafego/schema/trafego-schemas";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";

const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  const parsed = trafegoCheckoutBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.issues },
      { status: 422 },
    );
  }
  const { planId, campaignType, platform, objective, email, phone, companyName, briefing } =
    parsed.data;

  // ── 1. Plano ativo e coerente com a seleção ──────────────────────────────
  const plan = await prisma.trafegoPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      platform: true,
      campaignTypes: true,
      objectives: true,
      adBudgetBrlCents: true,
      serviceFeePercent: true,
      serviceFeeBrlCents: true,
      durationDays: true,
      isActive: true,
    },
  });

  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "Plano indisponível." }, { status: 404 });
  }
  if (plan.platform !== platform) {
    return NextResponse.json(
      { error: "Este plano não atende a plataforma escolhida." },
      { status: 400 },
    );
  }
  if (!plan.campaignTypes.includes(campaignType)) {
    return NextResponse.json(
      { error: "Este plano não atende o tipo de campanha escolhido." },
      { status: 400 },
    );
  }
  if (!plan.objectives.includes(objective)) {
    return NextResponse.json(
      { error: "Este plano não atende o objetivo escolhido." },
      { status: 400 },
    );
  }

  const price = computeTrafegoPrice({
    adBudgetBrlCents: plan.adBudgetBrlCents,
    serviceFeePercent: Number(plan.serviceFeePercent),
    serviceFeeBrlCents: plan.serviceFeeBrlCents,
  });

  if (price.totalBrlCents < STRIPE_MIN_BRL_CENTS) {
    return NextResponse.json(
      { error: "Valor abaixo do mínimo permitido pelo gateway." },
      { status: 400 },
    );
  }

  // ── 2. Idempotência: reusa pending recente e sessão ainda aberta ─────────
  const recentCutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
  const existing = await prisma.trafegoPendingPurchase.findFirst({
    where: {
      email,
      planId: plan.id,
      objective,
      status: "PENDING",
      createdAt: { gte: recentCutoff },
      stripeSessionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, stripeSessionId: true },
  });

  if (existing?.stripeSessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        existing.stripeSessionId,
      );
      if (session.url && session.status === "open") {
        return NextResponse.json({
          url: session.url,
          pendingId: existing.id,
          reused: true,
        });
      }
    } catch {
      // Sessão expirada/inválida no Stripe — segue e cria uma nova.
    }
  }

  // ── 3. Cria a compra pendente ────────────────────────────────────────────
  const pending = await prisma.trafegoPendingPurchase.create({
    data: {
      email,
      phone,
      companyName,
      flow: "public",
      planId: plan.id,
      campaignType,
      platform,
      objective,
      briefing: briefing ?? {},
      adBudgetBrlCents: price.adBudgetBrlCents,
      serviceFeeBrlCents: price.serviceFeeBrlCents,
      amountBrlCents: price.totalBrlCents,
      status: "PENDING",
    },
    select: { id: true },
  });

  // ── 4. Checkout Session ──────────────────────────────────────────────────
  const origin = req.nextUrl.origin;
  const platformLabel = PLATFORM_SHORT_LABEL[platform];
  const metadata = {
    kind: "trafego_order",
    flow: "public",
    pendingId: pending.id,
    planId: plan.id,
    platform,
    objective,
  };

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: price.adBudgetBrlCents,
              product_data: {
                name: `Verba de tráfego — ${plan.name}`,
                description: `${platformLabel} · ${plan.durationDays} dias de campanha`,
              },
            },
          },
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: price.serviceFeeBrlCents,
              product_data: {
                name: "Taxa de serviço NASA",
                description:
                  "Criação, configuração, acompanhamento e otimização da campanha",
              },
            },
          },
        ],
        success_url: `${origin}/trafego/sucesso?token=${pending.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/trafego?cancelado=1`,
        payment_method_types: ["card"],
        locale: "pt-BR",
        // Cupom sobre dois itens quebraria a divisão verba/taxa e viraria
        // problema contábil no repasse — ver spec 0008 §CB-14.
        allow_promotion_codes: false,
        metadata,
        // Propaga pro PaymentIntent: o handler de `payment_intent.succeeded`
        // (fallback e métodos assíncronos) depende disso pra reconhecer o kind.
        payment_intent_data: { metadata },
      },
      { idempotencyKey: `trafego-checkout:public:${pending.id}` },
    );

    if (!session.url) throw new Error("Stripe não retornou URL de checkout.");

    await prisma.trafegoPendingPurchase.update({
      where: { id: pending.id },
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      },
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: email,
      event: "trafego_checkout_started",
      properties: {
        plan_id: plan.id,
        plan_name: plan.name,
        platform,
        objective,
        campaign_type: campaignType,
        ad_budget_brl_cents: price.adBudgetBrlCents,
        service_fee_brl_cents: price.serviceFeeBrlCents,
        amount_brl_cents: price.totalBrlCents,
        pending_id: pending.id,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({ url: session.url, pendingId: pending.id });
  } catch (error) {
    // Pending virou lixo — marca como cancelada pra não poluir métricas nem
    // bloquear a idempotência da próxima tentativa.
    await prisma.trafegoPendingPurchase
      .update({ where: { id: pending.id }, data: { status: "CANCELLED" } })
      .catch(() => {});

    const message = error instanceof Error ? error.message : "Erro interno.";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Gateway de pagamento não configurado. Contate o suporte." },
        { status: 503 },
      );
    }
    console.error("[checkout/trafego]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
