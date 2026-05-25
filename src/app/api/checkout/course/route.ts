/**
 * POST /api/checkout/course
 *
 * Endpoint PÚBLICO (sem auth) — usado pelo modal de "Comprar curso" na página
 * pública /c/[companySlug]/[courseSlug]. O usuário só precisa do e-mail.
 *
 * Fluxo:
 *  1. Valida courseId + plan (default se não vier).
 *  2. Idempotência: se já existe PendingCoursePurchase PENDING <30 min com
 *     (email, courseId, planId), reusa stripeSessionId.
 *  3. Cria PendingCoursePurchase (status=PENDING).
 *  4. Cria Stripe Checkout Session com price_data dinâmico em BRL —
 *     valor lido direto de `plan.priceBrlCents`. metadata.kind="course_purchase"
 *     + flow="public" (signup token gerado no webhook).
 *  5. Persiste stripeSessionId na pending row e retorna { url }.
 *
 * Body: { courseId, planId?, email }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { getStarPriceBrl } from "@/features/nasa-route/lib/pricing";

const BodySchema = z.object({
  courseId: z.string().min(1),
  planId: z.string().min(1).optional(),
  email: z.string().email("E-mail inválido"),
});

const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.issues },
      { status: 422 },
    );
  }
  const { courseId, planId, email } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // ── 1. Curso publicado e pago? ───────────────────────────────────────────
  const course = await prisma.nasaRouteCourse.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      isFree: true,
      coverUrl: true,
      creatorOrg: { select: { slug: true, name: true } },
    },
  });
  if (!course || !course.isPublished) {
    return NextResponse.json({ error: "Curso não disponível." }, { status: 404 });
  }
  if (course.isFree) {
    return NextResponse.json(
      {
        error:
          "Curso gratuito — crie sua conta normalmente em /sign-up para acessar.",
      },
      { status: 400 },
    );
  }

  // ── 2. Plano (resolve default se não vier) ───────────────────────────────
  const plan = planId
    ? await prisma.nasaRoutePlan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          courseId: true,
          name: true,
          priceStars: true,
          priceBrlCents: true,
        },
      })
    : ((await prisma.nasaRoutePlan.findFirst({
        where: { courseId: course.id, isDefault: true },
        select: {
          id: true,
          courseId: true,
          name: true,
          priceStars: true,
          priceBrlCents: true,
        },
      })) ??
      (await prisma.nasaRoutePlan.findFirst({
        where: { courseId: course.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          courseId: true,
          name: true,
          priceStars: true,
          priceBrlCents: true,
        },
      })));

  if (!plan || plan.courseId !== course.id) {
    return NextResponse.json(
      { error: "Plano não encontrado para este curso." },
      { status: 404 },
    );
  }
  if (plan.priceBrlCents <= 0) {
    return NextResponse.json(
      {
        error:
          "Plano sem preço configurado — peça ao criador para definir o valor em reais.",
      },
      { status: 400 },
    );
  }

  // ── 3. Idempotência: reusa pending recente ──────────────────────────────
  const recentCutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
  const existing = await prisma.pendingCoursePurchase.findFirst({
    where: {
      email: normalizedEmail,
      courseId: course.id,
      planId: plan.id,
      status: "PENDING",
      createdAt: { gte: recentCutoff },
      stripeSessionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.stripeSessionId) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        existing.stripeSessionId,
      );
      if (session.url && session.status === "open") {
        return NextResponse.json({ url: session.url, reused: true });
      }
    } catch {
      // Sessão inválida/expirou no Stripe → cai pro fluxo normal e cria nova.
    }
  }

  // ── 4. Valor BRL (já é nativo no plano) ─────────────────────────────────
  const amountBrlCents = plan.priceBrlCents;
  if (amountBrlCents < 50) {
    // Stripe BRL: mínimo R$ 0,50
    return NextResponse.json(
      { error: "Valor abaixo do mínimo permitido pelo gateway." },
      { status: 400 },
    );
  }

  // Snapshot da cotação Stars→BRL, mantido por compatibilidade do payout
  // interno em STARs ao criador (ver finalizeStripePurchaseInTx).
  const starPriceBrl = await getStarPriceBrl();

  // ── 5. Cria PendingCoursePurchase (flow=public) ─────────────────────────
  const pending = await prisma.pendingCoursePurchase.create({
    data: {
      email: normalizedEmail,
      flow: "public",
      courseId: course.id,
      planId: plan.id,
      priceStars: plan.priceStars,
      amountBrlCents,
      starPriceBrlSnapshot: starPriceBrl,
      status: "PENDING",
    },
    select: { id: true },
  });

  // ── 6. Cria Stripe Checkout Session ──────────────────────────────────────
  const origin = req.nextUrl.origin;
  const successUrl = `${origin}/checkout/sucesso?token=${pending.id}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelPath = `/c/${course.creatorOrg.slug}/${course.slug}`;
  const cancelUrl = `${origin}${cancelPath}`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: normalizedEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: amountBrlCents,
            product_data: {
              name: `${course.title} — ${plan.name}`,
              description: `${plan.priceStars} ★ • ${course.creatorOrg.name}`,
              images: course.coverUrl ? [course.coverUrl] : undefined,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ["card"],
      locale: "pt-BR",
      allow_promotion_codes: true,
      metadata: {
        kind: "course_purchase",
        flow: "public",
        // Mantido por compatibilidade com webhooks antigos que ainda
        // matcham por "course_public_purchase".
        kindLegacy: "course_public_purchase",
        pendingId: pending.id,
        courseId: course.id,
        planId: plan.id,
      },
    });

    if (!session.url) {
      throw new Error("Stripe não retornou URL de checkout.");
    }

    await prisma.pendingCoursePurchase.update({
      where: { id: pending.id },
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
      },
    });

    return NextResponse.json({ url: session.url, pendingId: pending.id });
  } catch (err) {
    // Marca a pending como CANCELLED pra não poluir métricas com lixo.
    await prisma.pendingCoursePurchase
      .update({
        where: { id: pending.id },
        data: { status: "CANCELLED" },
      })
      .catch(() => {});

    const msg = err instanceof Error ? err.message : "Erro interno.";
    if (msg.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Gateway de pagamento não configurado. Contate o suporte." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
