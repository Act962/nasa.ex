/**
 * POST /api/checkout/trafego
 *
 * Endpoint PÚBLICO (sem auth) — usado pelo simulador em `/trafego`. O visitante
 * só precisa do e-mail; a conta é criada depois, no resgate.
 *
 * O preço NUNCA vem do browser: o body traz a verba escolhida e a resposta
 * sobre ter BM, e o servidor recalcula taxa e setup pela tabela de faixas.
 *
 * Fluxo:
 *  1. Recalcula a cotação a partir da verba (piso de R$ 300).
 *  2. Idempotência: reusa `TrafegoPendingPurchase` PENDING < 30 min com mesma
 *     (email, verba, objetivo) e a própria sessão Stripe, se ainda aberta.
 *  3. Cria a pending com o preço decomposto.
 *  4. Cria a Checkout Session com até TRÊS line_items — verba, serviço e setup.
 *  5. Persiste o id da sessão e devolve a URL.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { getStripe } from "@/lib/stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { STRIPE_MIN_BRL_CENTS } from "@/features/trafego/lib/pricing";
import { quoteTrafego } from "@/features/trafego/lib/pricing-tiers";
import { trafegoCheckoutBodySchema } from "@/features/trafego/schema/trafego-schemas";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { TRAFEGO_TERMS_VERSION } from "@/features/trafego/lib/legal";
import { ensureTrafegoLeadForPending } from "@/features/trafego/server/lib/ensure-trafego-lead";
import { createBriefingResponseForPending } from "@/features/trafego/server/lib/briefing-form-response";
import { isTrafegoPhoneVerified } from "@/features/trafego/server/lib/phone-verification";
import { checkWhatsappNumber } from "@/features/trafego/server/lib/whatsapp-number-check";
import { lookupSocialProfile } from "@/features/trafego/server/lib/social-profile-lookup";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import {
  buildPixReceiptMessage,
  generatePixReference,
} from "@/features/trafego/lib/pix";
import { checkAdCompliance } from "@/features/trafego/server/lib/compliance-check";
import {
  estimateEarliestStart,
  isDesiredStartTooSoon,
} from "@/features/trafego/lib/timeline";

const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

/**
 * Converte um snapshot tipado (perfil social, checagem de número, achados de
 * política) para o `Json` do Prisma. O cast existe porque `InputJsonValue`
 * recusa `null` em campo aninhado, e nossos tipos usam `string | null` —
 * o round-trip por JSON normaliza isso sem mentir sobre o conteúdo.
 */
function toJsonSnapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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
  const {
    organizationId,
    adBudgetBrlCents,
    hasBusinessManager,
    campaignType,
    platform,
    objective,
    email,
    phone,
    companyName,
    briefing,
    socialHandle,
    hasOfficialNumber,
    officialNumber,
    paymentMethod,
    complianceAcknowledged,
    desiredStartAt,
    hasSocialLinked,
    materialsReady,
    startAcknowledged,
    desiredCreativeCount,
  } = parsed.data;

  const session = await auth.api
    .getSession({ headers: req.headers })
    .catch(() => null);
  const activeOrganizationId = session?.session.activeOrganizationId;
  const authenticatedMembership =
    session?.user && organizationId && activeOrganizationId === organizationId
      ? await prisma.member.findFirst({
          where: { userId: session.user.id, organizationId },
          select: { organizationId: true },
        })
      : null;
  const isAuthenticatedFlow = Boolean(authenticatedMembership && session?.user);
  const buyerEmail = isAuthenticatedFlow ? session!.user.email : email;
  const buyerUserId = isAuthenticatedFlow ? session!.user.id : null;
  const flow = isAuthenticatedFlow ? "authenticated" : "public";

  const isPix = paymentMethod === "PIX";

  // "unsure" é tratado como quem não tem: se na verificação a conta existir, a
  // equipe estorna o setup. Melhor sobrar do que descobrir depois que faltou.
  // No WhatsApp Oficial o setup é o número na API (aquisição + configuração).
  const isWhatsappChannel = platform === "WHATSAPP_OFICIAL";
  const needsSetup = isWhatsappChannel
    ? (hasOfficialNumber ?? "unsure") !== "yes"
    : hasBusinessManager !== "yes";
  const settings = await loadTrafegoSettings();
  const creativeCount = desiredCreativeCount ?? settings.includedCreatives;
  const extraCreatives = Math.max(
    0,
    creativeCount - settings.includedCreatives,
  );
  const quote = quoteTrafego(
    adBudgetBrlCents,
    needsSetup,
    extraCreatives,
    settings.extraCreativeBrlCents,
  );

  if (quote.totalBrlCents < STRIPE_MIN_BRL_CENTS) {
    return NextResponse.json(
      { error: "Valor abaixo do mínimo permitido pelo gateway." },
      { status: 400 },
    );
  }

  // ── Prazo ─────────────────────────────────────────────────────────────
  // Recalculado aqui: o browser mostra a data, mas quem grava é o servidor.
  const startEstimate = estimateEarliestStart({
    hasAdAccount: isWhatsappChannel
      ? (hasOfficialNumber ?? "unsure") === "yes"
      : hasBusinessManager === "yes",
    hasSocialLinked: hasSocialLinked ?? null,
    materialsReady: materialsReady ?? null,
  });

  if (
    isDesiredStartTooSoon(desiredStartAt, startEstimate.earliestStart) &&
    !startAcknowledged
  ) {
    return NextResponse.json(
      {
        error:
          "Confirme que entendeu a data realista de início antes de continuar.",
        earliestStartAt: startEstimate.earliestStart.toISOString(),
      },
      { status: 422 },
    );
  }

  // ── Políticas de publicidade ──────────────────────────────────────────
  // Roda antes de criar a pendência: não adianta registrar compra de algo que
  // a plataforma vai recusar. O que o browser mandou não é confiável — o
  // mesmo código roda aqui.
  const compliance = await checkAdCompliance({
    platform,
    businessName: briefing?.businessName ?? companyName,
    businessNiche: briefing?.businessNiche,
    audience: briefing?.targetAudience,
    destination: briefing?.destinationUrl,
  }).catch((error) => {
    console.error("[checkout/trafego] checagem de políticas falhou:", error);
    return null;
  });

  if (compliance?.level === "BLOCKED") {
    return NextResponse.json(
      {
        error:
          "Este anúncio não pode ser veiculado pelas regras da plataforma. Fale com um gestor para avaliarmos o caso.",
        compliance: { level: compliance.level, issues: compliance.issues },
      },
      { status: 422 },
    );
  }

  if (compliance?.level === "WARNING" && !complianceAcknowledged) {
    return NextResponse.json(
      {
        error: "Confirme que leu os pontos de atenção antes de continuar.",
        compliance: { level: compliance.level, issues: compliance.issues },
      },
      { status: 422 },
    );
  }

  // ── Idempotência: reusa pending recente e sessão ainda aberta ────────────
  // Só no cartão: a sessão do Stripe é o que se reaproveita. No PIX cada
  // tentativa gera referência nova, que é o que o cliente cita no comprovante.
  const recentCutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
  const existing = await prisma.trafegoPendingPurchase.findFirst({
    where: {
      email: buyerEmail,
      objective,
      flow,
      userId: buyerUserId,
      adBudgetBrlCents: quote.adBudgetBrlCents,
      setupFeeBrlCents: quote.setupBrlCents,
      status: "PENDING",
      createdAt: { gte: recentCutoff },
      stripeSessionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, stripeSessionId: true },
  });

  if (!isPix && existing?.stripeSessionId) {
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

  // Snapshots das verificações do wizard. O browser só manda o que digitou; o
  // que vale é o que o servidor confere agora (prova de OTP, lookup, checagem).
  const [phoneVerified, socialProfile, officialNumberCheck] = await Promise.all(
    [
      isTrafegoPhoneVerified(phone).catch(() => false),
      socialHandle
        ? lookupSocialProfile(socialHandle).catch(() => null)
        : Promise.resolve(null),
      isWhatsappChannel && officialNumber
        ? checkWhatsappNumber(officialNumber).catch(() => null)
        : Promise.resolve(null),
    ],
  );

  const pending = await prisma.trafegoPendingPurchase.create({
    data: {
      email: buyerEmail,
      phone,
      companyName,
      userId: buyerUserId,
      phoneVerifiedAt: phoneVerified ? new Date() : null,
      socialHandle: socialHandle || null,
      socialProfile: toJsonSnapshot(socialProfile),
      hasOfficialNumber: isWhatsappChannel
        ? hasOfficialNumber === "unsure" || !hasOfficialNumber
          ? null
          : hasOfficialNumber === "yes"
        : null,
      officialNumber: isWhatsappChannel ? officialNumber || null : null,
      officialNumberCheck: toJsonSnapshot(officialNumberCheck),
      paymentMethod,
      complianceLevel: compliance?.level ?? null,
      complianceIssues: toJsonSnapshot(compliance?.issues),
      complianceAcknowledgedAt:
        compliance?.level === "WARNING" && complianceAcknowledged
          ? new Date()
          : null,
      desiredStartAt: desiredStartAt
        ? new Date(`${desiredStartAt}T12:00:00`)
        : null,
      earliestStartAt: startEstimate.earliestStart,
      startAcknowledgedAt: startAcknowledged ? new Date() : null,
      hasSocialLinked: hasSocialLinked ?? null,
      materialsReady: materialsReady ?? null,
      desiredCreativeCount: creativeCount,
      flow,
      campaignType,
      platform,
      objective,
      briefing: {
        ...(briefing ?? {}),
        ...(isAuthenticatedFlow && organizationId
          ? { _organizationId: organizationId }
          : {}),
      },
      hasBusinessManager:
        hasBusinessManager === "unsure" ? null : hasBusinessManager === "yes",
      acceptedTermsAt: new Date(),
      acceptedTermsVersion: TRAFEGO_TERMS_VERSION,
      adBudgetBrlCents: quote.adBudgetBrlCents,
      serviceFeePercent: quote.feePercent,
      serviceFeeBrlCents: quote.serviceFeeBrlCents,
      setupFeeBrlCents: quote.setupBrlCents,
      amountBrlCents: quote.totalBrlCents,
      status: "PENDING",
    },
    select: { id: true },
  });

  // Card em "Aguardando pagamento" + resposta "Briefing TrafeGO" no card. É
  // aqui que a equipe passa a ver o cliente — antes do dinheiro. Best-effort:
  // falha não impede o checkout.
  try {
    await ensureTrafegoLeadForPending(pending.id);
    await createBriefingResponseForPending(pending.id);
  } catch (error) {
    console.error("[checkout/trafego] card/briefing falhou:", error);
  }

  if (isPix) {
    const freshSettings = await loadTrafegoSettings({ fresh: true });
    if (!freshSettings.pixKey) {
      // Sem chave configurada não há como o cliente pagar. Falhar aqui é melhor
      // do que mostrar uma tela de PIX vazia depois de ele escolher.
      await prisma.trafegoPendingPurchase.update({
        where: { id: pending.id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json(
        {
          error:
            "Pagamento por PIX indisponível no momento. Use cartão ou fale com um gestor.",
        },
        { status: 503 },
      );
    }

    const reference = await claimPixReference(pending.id);
    const expiresAt = new Date(
      Date.now() + freshSettings.pixExpiryHours * 60 * 60 * 1000,
    );
    await prisma.trafegoPendingPurchase.update({
      where: { id: pending.id },
      data: { pixReference: reference, pixExpiresAt: expiresAt },
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: buyerUserId ?? buyerEmail,
      event: "trafego_checkout_started",
      properties: {
        pending_id: pending.id,
        payment_method: "pix",
        platform,
        objective,
        amount_brl_cents: quote.totalBrlCents,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({
      paymentMethod: "PIX" as const,
      pendingId: pending.id,
      pix: {
        key: freshSettings.pixKey,
        holderName: freshSettings.pixHolderName,
        bankName: freshSettings.pixBankName,
        reference,
        amountBrlCents: quote.totalBrlCents,
        expiresAt: expiresAt.toISOString(),
        supportWhatsapp: freshSettings.supportWhatsapp,
        receiptMessage: buildPixReceiptMessage({
          reference,
          amountLabel: (quote.totalBrlCents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          businessName: companyName ?? null,
        }),
      },
    });
  }

  const origin = req.nextUrl.origin;
  const platformLabel = PLATFORM_SHORT_LABEL[platform];
  const metadata = {
    kind: "trafego_order",
    flow,
    pendingId: pending.id,
    platform,
    objective,
  };

  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: "brl" as const,
        unit_amount: quote.adBudgetBrlCents,
        product_data: {
          name: "Verba de tráfego",
          description: `${platformLabel} · investido integralmente nos anúncios`,
        },
      },
    },
    {
      quantity: 1,
      price_data: {
        currency: "brl" as const,
        unit_amount: quote.serviceFeeBrlCents,
        product_data: {
          name: `Serviço Órbita (${quote.feePercent}%)`,
          description: "Criação, configuração, acompanhamento e otimização",
        },
      },
    },
  ];

  if (quote.setupBrlCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "brl" as const,
        unit_amount: quote.setupBrlCents,
        product_data: {
          name: isWhatsappChannel
            ? "Setup do número na API Oficial"
            : "Setup da conta de anúncios (BM)",
          description: isWhatsappChannel
            ? "Aquisição e configuração do número na API Oficial do WhatsApp — cobrança única"
            : "Criação e configuração da Business Manager — cobrança única",
        },
      },
    });
  }

  if (quote.extraCreativesBrlCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "brl" as const,
        unit_amount: quote.extraCreativesBrlCents,
        product_data: {
          name: "Criativos extras",
          description: `${extraCreatives} criativo${extraCreatives === 1 ? "" : "s"} adicional${extraCreatives === 1 ? "" : "is"}`,
        },
      },
    });
  }

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: buyerEmail,
        line_items: lineItems,
        success_url: `${origin}/trafego/sucesso?token=${pending.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/trafego?cancelado=1`,
        payment_method_types: ["card"],
        locale: "pt-BR",
        // Ligado para permitir cortesia e teste ponta a ponta em produção.
        //
        // ATENÇÃO — o desconto NÃO é rastreado: o Stripe aplica o cupom sobre a
        // sessão inteira e não diz qual item absorveu, e nada aqui grava quanto
        // foi. Consequências enquanto for assim:
        //   · `amountMismatch` é marcado em toda compra com cupom (o esperado é
        //     comparado contra o valor contratado, não contra o cobrado);
        //   · `createTrafegoSaleSideEffects` lança receita e repasse pelos
        //     valores CONTRATADOS — um pedido com 100% de desconto cria
        //     lançamento de dinheiro que não entrou, e verba sem lastro.
        // Use cupom só em pedido de teste, e apague os lançamentos depois.
        // O tratamento correto está desenhado na spec 0010 (rascunho) e
        // registrado como P-9 em docs/trafego-correcoes-pendentes.md.
        allow_promotion_codes: true,
        metadata,
        // Propaga pro PaymentIntent: o handler de `payment_intent.succeeded`
        // (fallback e métodos assíncronos) depende disso pra reconhecer o kind.
        payment_intent_data: { metadata },
      },
      { idempotencyKey: `trafego-checkout:${flow}:${pending.id}` },
    );

    if (!session.url) throw new Error("Stripe não retornou URL de checkout.");

    await prisma.trafegoPendingPurchase.update({
      where: { id: pending.id },
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
      },
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: buyerUserId ?? buyerEmail,
      event: "trafego_checkout_started",
      properties: {
        platform,
        objective,
        campaign_type: campaignType,
        has_business_manager: hasBusinessManager,
        ad_budget_brl_cents: quote.adBudgetBrlCents,
        service_fee_percent: quote.feePercent,
        service_fee_brl_cents: quote.serviceFeeBrlCents,
        setup_fee_brl_cents: quote.setupBrlCents,
        amount_brl_cents: quote.totalBrlCents,
        tier: quote.tier.id,
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

/**
 * Referência única do PIX. Colisão é improvável (32^4), mas a coluna é
 * `@unique` — em vez de confiar na sorte, tentamos algumas vezes e caímos num
 * sufixo derivado do id da pendência, que é único por construção.
 */
async function claimPixReference(pendingId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generatePixReference();
    const taken = await prisma.trafegoPendingPurchase.count({
      where: { pixReference: candidate },
    });
    if (taken === 0) return candidate;
  }
  return `TGP-${pendingId.slice(-6).toUpperCase()}`;
}
