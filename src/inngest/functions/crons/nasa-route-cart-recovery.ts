/**
 * Cron: nasa-route-cart-recovery
 *
 * Varre `PendingCoursePurchase` PENDING e envia emails de recuperação
 * de carrinho em uma cadência multi-stage (D+1 / D+3 / D+7 / D+15) até
 * o lead pagar OU 30 dias passarem (status → ABANDONED).
 *
 * Roda 4× ao dia (cada 6h). Cada execução:
 *   1. Lê todos os PENDING criados há ≥ 1 dia
 *   2. Pra cada um, calcula `daysSinceCreated` e qual estágio aplicar
 *   3. Pula se `lastReminderStage` já foi enviado pra esse estágio
 *   4. Envia email via Resend (template cart-abandoned-course)
 *   5. Atualiza `lastReminderSentAt` + `lastReminderStage`
 *   6. Após 30+ dias → marca como ABANDONED (cron para de tentar)
 *
 * Best-effort por item: erro em um pending não derruba os outros.
 *
 * Por que cron e não agent-mode workflow?
 *   - Pendings podem nascer sem Lead (flow="public", anônimo)
 *   - Workflows agent-mode são lead-scoped
 *   - Cron é o caminho mais direto pra varrer tabela e bater email
 *
 * Tem disparador on-demand via evento `nasa-route/cart-recovery.run`
 * pra testes manuais.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import {
  reactCartAbandonedCourseEmail,
  type CartAbandonedStage,
} from "@/lib/email/cart-abandoned-course";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@nasaagents.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nasaagents.com";

// Mapa: dias desde criação → estágio que deve ser enviado.
// Cron decide o estágio mais recente PERTINENTE que ainda não foi mandado.
const STAGES: Array<{ stage: CartAbandonedStage; minDays: number }> = [
  { stage: "d1", minDays: 1 },
  { stage: "d3", minDays: 3 },
  { stage: "d7", minDays: 7 },
  { stage: "d15", minDays: 15 },
];

const ABANDON_AFTER_DAYS = 30;

interface PendingRow {
  id: string;
  email: string;
  amountBrlCents: number;
  createdAt: Date;
  lastReminderStage: string | null;
  course: { title: string; creatorOrg: { name: string } };
  plan: { name: string } | null;
}

function pickStageToSend(
  daysSinceCreated: number,
  lastStage: string | null,
): CartAbandonedStage | null {
  // Procura o ESTÁGIO MAIS ALTO cujo minDays já foi atingido E que ainda
  // não foi enviado. Evita pular estágios (D+1 antes de D+3 etc) e evita
  // duplicar (não reenvia D+3 se já mandou).
  const lastIdx = lastStage
    ? STAGES.findIndex((s) => s.stage === lastStage)
    : -1;
  // Próximo estágio que ainda não foi enviado
  for (let i = lastIdx + 1; i < STAGES.length; i++) {
    if (daysSinceCreated >= STAGES[i].minDays) {
      return STAGES[i].stage;
    }
  }
  return null;
}

async function processSinglePending(p: PendingRow): Promise<{
  status: "sent" | "skipped" | "abandoned" | "failed";
  reason?: string;
  stage?: CartAbandonedStage;
}> {
  const ageMs = Date.now() - p.createdAt.getTime();
  const daysSinceCreated = Math.floor(ageMs / (24 * 3600 * 1000));

  // ── 1. Abandonar se passou de 30 dias ────────────────────────
  if (daysSinceCreated >= ABANDON_AFTER_DAYS) {
    await prisma.pendingCoursePurchase.update({
      where: { id: p.id },
      data: { status: "ABANDONED" },
    });
    return { status: "abandoned", reason: `>${ABANDON_AFTER_DAYS}d sem pagar` };
  }

  // ── 2. Decidir estágio ───────────────────────────────────────
  const stage = pickStageToSend(daysSinceCreated, p.lastReminderStage);
  if (!stage) {
    return {
      status: "skipped",
      reason: `dia ${daysSinceCreated} — sem estágio novo (último: ${p.lastReminderStage ?? "nenhum"})`,
    };
  }

  // ── 3. Renderizar + enviar ───────────────────────────────────
  // Reconstrói checkout URL — o pending ainda tem stripeSessionId válido?
  // Stripe expira sessões em ~24h. Pra D+1+, sessão geralmente já morreu.
  // Pra ser correto, o link deve ir pra página de detalhe do curso (onde
  // o lead reinicia o checkout). Mais robusto + funciona pra qualquer estágio.
  // Vamos descobrir courseSlug + companySlug via query extra.
  const courseInfo = await prisma.nasaRouteCourse.findUnique({
    where: { id: (await getCourseId(p.id)) ?? "" },
    select: {
      slug: true,
      creatorOrg: { select: { slug: true } },
    },
  });

  let checkoutUrl: string;
  if (courseInfo?.slug && courseInfo.creatorOrg.slug) {
    checkoutUrl = `${APP_URL}/c/${courseInfo.creatorOrg.slug}/${courseInfo.slug}`;
  } else {
    // Fallback: home do NASA Route
    checkoutUrl = `${APP_URL}/nasa-route`;
  }

  const studentName = p.email.split("@")[0] ?? "Aluno";

  try {
    const sendResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: p.email,
      subject:
        stage === "d1"
          ? "Sua matrícula NASA Route te espera"
          : stage === "d3"
            ? "Vimos que você ainda não finalizou"
            : stage === "d7"
              ? "Última chamada — sua vaga vai ser liberada"
              : "Última oportunidade — link expira em breve",
      react: reactCartAbandonedCourseEmail({
        studentName,
        studentEmail: p.email,
        courseTitle: p.course.title,
        planName: p.plan?.name ?? "Acesso ao curso",
        creatorName: p.course.creatorOrg.name,
        amountBrl: p.amountBrlCents / 100,
        checkoutUrl,
        stage,
      }),
    });

    if (sendResult.error) {
      return {
        status: "failed",
        reason: sendResult.error.message ?? "resend_error",
        stage,
      };
    }

    // ── 4. Atualizar tracking de envio ──────────────────────────
    await prisma.pendingCoursePurchase.update({
      where: { id: p.id },
      data: {
        lastReminderSentAt: new Date(),
        lastReminderStage: stage,
      },
    });

    return { status: "sent", stage };
  } catch (err) {
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "unknown_error",
      stage,
    };
  }
}

// Helper isolado (typing fica complicado embedded). Devolve courseId
// já que o select inicial não trouxe pra economizar payload.
async function getCourseId(pendingId: string): Promise<string | null> {
  const row = await prisma.pendingCoursePurchase.findUnique({
    where: { id: pendingId },
    select: { courseId: true },
  });
  return row?.courseId ?? null;
}

export const nasaRouteCartRecoveryCron = inngest.createFunction(
  {
    id: "nasa-route-cart-recovery",
    retries: 1,
    // Limita concorrência pra evitar burst no Resend (rate limit é 100/s
    // no free tier; mantemos 1 instância em execução).
    concurrency: { limit: 1 },
  },
  [
    // 4× ao dia: 00:00, 06:00, 12:00, 18:00 UTC
    { cron: "0 0,6,12,18 * * *" },
    // Disparador on-demand pra testes
    { event: "nasa-route/cart-recovery.run" },
  ],
  async ({ step }) => {
    // Pega só PENDING criados há ≥ 1 dia (poupa scan de pendings novos)
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const pendings = await step.run("fetch-pendings", () =>
      prisma.pendingCoursePurchase.findMany({
        where: {
          status: "PENDING",
          createdAt: { lte: oneDayAgo },
        },
        select: {
          id: true,
          email: true,
          amountBrlCents: true,
          createdAt: true,
          lastReminderStage: true,
          course: {
            select: {
              title: true,
              creatorOrg: { select: { name: true } },
            },
          },
          plan: { select: { name: true } },
        },
        // Limite defensivo — se acumular milhares, processamos em batches
        take: 500,
      }),
    );

    const counters = {
      sent: 0,
      skipped: 0,
      abandoned: 0,
      failed: 0,
    };

    for (const p of pendings) {
      const result = await step.run(`process-${p.id}`, () =>
        processSinglePending(p),
      );
      counters[result.status]++;
      if (result.status === "failed") {
        console.warn(
          `[nasa-route-cart-recovery] failed ${p.id} (${result.stage}):`,
          result.reason,
        );
      }
    }

    return {
      scanned: pendings.length,
      ...counters,
      ranAt: new Date().toISOString(),
    };
  },
);
