import prisma from "@/lib/prisma";
import { getStarPriceBrl, starsToBrlCents } from "@/features/nasa-route/lib/pricing";

/**
 * Efeitos colaterais ao comprar curso NASA Route — fire-and-forget,
 * NÃO bloqueiam a compra principal.
 *
 *  1. **Lead destination**: se o criador configurou `purchaseTrackingId`
 *     (+ opcional `purchaseStatusId`) no curso, cria um lead novo nesse
 *     tracking pro comprador (ou ativa se já existir).
 *
 *  2. **PaymentEntry RECEIVABLE**: registra a venda no módulo Payments
 *     do criador. Valor em centavos BRL derivado do preço em STARs.
 *     Status PAID (já foi pago no momento). Vínculo com o lead criado
 *     pra histórico unificado.
 *
 * Falhas são logadas no console mas não throw — a compra já foi
 * concluída e os SP/transações Stars não devem ser revertidos por
 * problema secundário de CRM/Payments.
 */
interface CreatePurchaseSideEffectsInput {
  /** Buyer (aluno comprando). Pode ser null em compras públicas via checkout. */
  buyer: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  /** Org do criador — destino do lead + payment entry. */
  creatorOrgId: string;
  /** Quem registrou a compra (pode ser o aluno logado ou ser system). */
  createdByUserId?: string | null;
  course: {
    id: string;
    title: string;
    priceStars: number;
    purchaseTrackingId: string | null;
    purchaseStatusId: string | null;
  };
  planName: string;
  enrollmentId: string;
}

export async function createPurchaseSideEffects(
  input: CreatePurchaseSideEffectsInput,
): Promise<void> {
  let leadId: string | null = null;

  // ── 1. Lead destination ───────────────────────────────────
  if (input.course.purchaseTrackingId) {
    try {
      leadId = await createOrActivateLead({
        trackingId: input.course.purchaseTrackingId,
        explicitStatusId: input.course.purchaseStatusId,
        buyer: input.buyer,
        courseTitle: input.course.title,
      });
    } catch (err) {
      console.error("[nasa-route/purchase-side-effects] lead failed:", err);
    }
  }

  // ── 2. PaymentEntry RECEIVABLE ─────────────────────────────
  // Mesmo sem lead/tracking configurado, ainda registramos a venda no
  // financeiro do criador (org). Isso garante métricas independentemente
  // da configuração de CRM.
  try {
    const starPriceBrl = await getStarPriceBrl();
    const amountCents = starsToBrlCents(input.course.priceStars, starPriceBrl);

    await prisma.paymentEntry.create({
      data: {
        organizationId: input.creatorOrgId,
        type: "RECEIVABLE",
        status: "PAID", // já foi pago via STARs no momento da compra
        description: `Venda NASA Route — ${input.course.title} (${input.planName})`,
        amount: amountCents,
        paidAmount: amountCents,
        dueDate: new Date(),
        paidAt: new Date(),
        trackingId: input.course.purchaseTrackingId ?? null,
        leadId,
        notes: `Plano: ${input.planName} · Curso: ${input.course.title} · Preço: ${input.course.priceStars}★`,
        createdById: input.createdByUserId ?? null,
      },
    });
  } catch (err) {
    console.error("[nasa-route/purchase-side-effects] payment entry failed:", err);
  }

  // ── 3. Dispatch agent-workflow PAYMENT_RECEIVED ─────────────
  // Reemite o evento agora COM leadId/trackingId reais E enriquecido com
  // dados do curso. O webhook Stripe original lê leadId da metadata da
  // session, mas o NASA Route checkout cria a session ANTES do Lead
  // existir — sem essa reemissão, o trigger PAYMENT_RECEIVED do agent-mode
  // nunca bate com workflow do tracking destino. Best-effort.
  //
  // Os campos extras (courseTitle, planName, etc.) ficam visíveis no
  // contexto via {{trigger.courseTitle}}, etc — usados pelo SEND_EMAIL
  // welcome-course pra preencher o template sem query adicional.
  if (leadId && input.course.purchaseTrackingId) {
    try {
      const { dispatchPaymentReceived } = await import(
        "@/features/workflows/lib/agent-trigger-helpers"
      );
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await dispatchPaymentReceived({
        provider: "STRIPE",
        externalId: input.enrollmentId,
        organizationId: input.creatorOrgId,
        trackingId: input.course.purchaseTrackingId,
        leadId,
        extra: {
          courseId: input.course.id,
          courseTitle: input.course.title,
          planName: input.planName,
          enrollmentId: input.enrollmentId,
          coursePlayerUrl: `${baseUrl}/nasa-route/curso/${input.course.id}`,
          studentName: input.buyer.name ?? null,
          studentEmail: input.buyer.email ?? null,
          studentPhone: input.buyer.phone ?? null,
        },
      });
    } catch (err) {
      console.error(
        "[nasa-route/purchase-side-effects] agent dispatch failed:",
        err,
      );
    }
  }
}

/**
 * Cria lead novo no tracking destino — OU ativa lead existente (matched
 * por email/telefone). Devolve o `leadId` final pra anexar no
 * PaymentEntry.
 */
async function createOrActivateLead(args: {
  trackingId: string;
  explicitStatusId: string | null;
  buyer: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  courseTitle: string;
}): Promise<string | null> {
  const { trackingId, explicitStatusId, buyer, courseTitle } = args;

  // Resolve status: explícito tem prioridade; senão pega a primeira coluna
  // do tracking (menor `order`).
  let statusId = explicitStatusId;
  if (!statusId) {
    const firstStatus = await prisma.status.findFirst({
      where: { trackingId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!firstStatus) {
      console.warn(
        `[nasa-route/purchase-side-effects] tracking ${trackingId} has no status — skip lead`,
      );
      return null;
    }
    statusId = firstStatus.id;
  }

  // Reutiliza lead se já existir um neste tracking com mesmo email/phone
  // (evita duplicação quando o aluno recompra o mesmo curso).
  const existing = await prisma.lead.findFirst({
    where: {
      trackingId,
      OR: [
        buyer.email ? { email: buyer.email } : undefined,
        buyer.phone ? { phone: buyer.phone } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true },
  });

  if (existing) {
    // Move pro status configurado + adiciona nota no histórico.
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        statusId,
        statusEnteredAt: new Date(),
        currentAction: "ACTIVE",
      },
    });
    return existing.id;
  }

  // Cria novo lead.
  const newLead = await prisma.lead.create({
    data: {
      trackingId,
      statusId,
      name: buyer.name ?? buyer.email ?? "Comprador NASA Route",
      email: buyer.email ?? null,
      phone: buyer.phone ?? null,
      description: `Comprou: ${courseTitle}`,
      statusEnteredAt: new Date(),
      currentAction: "ACTIVE",
    },
    select: { id: true },
  });

  return newLead.id;
}
