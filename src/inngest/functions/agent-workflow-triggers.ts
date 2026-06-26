/**
 * Inngest functions que disparam workflows do Modo Agente IA a partir dos
 * 3 trigger types novos: PAYMENT_RECEIVED, MESSAGE_INCOMING, WEBHOOK_EXTERNAL.
 *
 * Padrão:
 *  1. Evento entra (publicado pelo webhook do Stripe/Asaas/WhatsApp/HTTP)
 *  2. Busca todos os Workflows ATIVOS em `agentMode=true` com node desse trigger
 *  3. Pra cada um: dispara `runWorkflow` com o payload do evento como contexto
 *
 * Fan-out: cada workflow ativo é executado em paralelo via fan-out de eventos
 * (`step.sendEvent` com 1 evento por workflow). Isolamento de step IDs.
 *
 * Cancelamento: workflows que dependem de `WAIT_FOR_EVENT` são re-acordados
 * por handlers separados (Fase 4 — wait/resume engine completo).
 */
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

// ─── Helper ────────────────────────────────────────

async function dispatchToMatchingWorkflows(params: {
  triggerType: string;
  triggerPayload: Record<string, unknown>;
  organizationId: string;
  trackingId?: string | null;
  leadId?: string | null;
}) {
  const { triggerType, triggerPayload, organizationId, trackingId, leadId } = params;

  const workflows = await prisma.workflow.findMany({
    where: {
      agentMode: true,
      isActive: true,
      tracking: { organizationId },
      ...(trackingId
        ? { OR: [{ trackingId }, { trackingId: null }] }
        : {}),
      nodes: {
        some: { type: triggerType as never },
      },
    },
    select: { id: true },
  });

  if (workflows.length === 0) {
    return { matched: 0, dispatched: 0 };
  }

  // Importante: chamamos `sendWorkflowExecution` (= evento Inngest
  // `workflow/execute.workflow`) em vez de `runWorkflow` direto. Isso garante
  // que cada workflow rode dentro da Inngest function `executeWorkflow`
  // — que faz o loop de step.waitForEvent + resume pra workflows com
  // WAIT/WAIT_FOR_EVENT. Chamada direta ao runWorkflow funciona pra
  // workflows sem suspend, mas deixa workflows com WAIT órfãos no
  // banco (SUSPENDED pra sempre). Best-effort por wf — falha em um
  // não derruba os outros.
  const { sendWorkflowExecution } = await import("@/inngest/utils");
  let dispatched = 0;
  for (const wf of workflows) {
    try {
      await sendWorkflowExecution({
        workflowId: wf.id,
        triggerType: triggerType as
          | "PAYMENT_RECEIVED"
          | "MESSAGE_INCOMING"
          | "WEBHOOK_EXTERNAL",
        leadId: leadId ?? null,
        initialData: { ...triggerPayload, organizationId, trackingId },
      });
      dispatched++;
    } catch (err) {
      console.error("[agent-workflow-trigger]", wf.id, err);
    }
  }

  return { matched: workflows.length, dispatched };
}

// ─── PAYMENT_RECEIVED ──────────────────────────────
// Disparado por webhook Stripe/Asaas/StarsPayment quando pagamento confirma.
// Quem publica: src/app/api/stripe/webhook/route.ts, src/app/api/payments/asaas/webhook/route.ts
// Payload: { provider, externalId, amount, leadId, organizationId, trackingId }
export const agentTriggerPaymentReceivedFn = inngest.createFunction(
  {
    id: "agent-trigger-payment-received",
    concurrency: { limit: 5 },
  },
  { event: "agent-workflow/payment-received" },
  async ({ event, step }) => {
    const data = event.data as {
      provider: string;
      externalId: string;
      amount?: number;
      leadId?: string | null;
      organizationId: string;
      trackingId?: string | null;
      // Campos opcionais "extras" injetados pelo caller (purchase-side-effects
      // do NASA Route passa courseTitle/planName/creatorName/coursePlayerUrl
      // pra ficarem disponíveis em {{trigger.X}} no workflow).
      [extraKey: string]: unknown;
    };

    // Filtra campos conhecidos da estrutura padrão; o resto vai pro
    // triggerPayload pra ficar visível no contexto do workflow.
    const knownKeys = new Set([
      "provider",
      "externalId",
      "amount",
      "leadId",
      "organizationId",
      "trackingId",
    ]);
    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!knownKeys.has(k)) extras[k] = v;
    }

    return await step.run("dispatch-workflows", async () =>
      dispatchToMatchingWorkflows({
        triggerType: "PAYMENT_RECEIVED",
        triggerPayload: {
          provider: data.provider,
          externalId: data.externalId,
          amount: data.amount,
          ...extras,
        },
        organizationId: data.organizationId,
        trackingId: data.trackingId ?? null,
        leadId: data.leadId ?? null,
      }),
    );
  },
);

// ─── MESSAGE_INCOMING ──────────────────────────────
// Disparado por webhook WhatsApp quando lead manda msg nova.
// Quem publica: src/app/api/whatsapp/webhook/route.ts (a integrar — Fase 4).
// Payload: { messageText, leadId, organizationId, trackingId, messageId }
export const agentTriggerMessageIncomingFn = inngest.createFunction(
  {
    id: "agent-trigger-message-incoming",
    concurrency: { limit: 5 },
  },
  { event: "agent-workflow/message-incoming" },
  async ({ event, step }) => {
    const data = event.data as {
      messageText: string;
      leadId: string;
      organizationId: string;
      trackingId: string;
      messageId?: string;
    };

    return await step.run("dispatch-workflows", async () =>
      dispatchToMatchingWorkflows({
        triggerType: "MESSAGE_INCOMING",
        triggerPayload: {
          messageText: data.messageText,
          messageId: data.messageId,
        },
        organizationId: data.organizationId,
        trackingId: data.trackingId,
        leadId: data.leadId,
      }),
    );
  },
);

// ─── WEBHOOK_EXTERNAL ──────────────────────────────
// Disparado por endpoint público HTTP que aceita payloads de sistemas
// terceiros (Zapier, Make, scripts custom). Endpoint a criar em Fase 3:
// POST /api/agent-webhook/[workflowId] valida secret e publica evento.
// Payload: { headers, body, workflowId, organizationId }
export const agentTriggerWebhookExternalFn = inngest.createFunction(
  {
    id: "agent-trigger-webhook-external",
    concurrency: { limit: 5 },
  },
  { event: "agent-workflow/webhook-external" },
  async ({ event, step }) => {
    const data = event.data as {
      workflowId: string;
      organizationId: string;
      trackingId?: string | null;
      payload: Record<string, unknown>;
    };

    return await step.run("dispatch-single-workflow", async () => {
      // Mesmo padrão dos outros triggers: dispara via sendWorkflowExecution
      // (= evento Inngest workflow/execute.workflow) pra que `executeWorkflow`
      // rode o loop completo com step.waitForEvent + resume. Chamada direta
      // a `runWorkflow` deixava workflows com WAIT órfãos.
      try {
        const { sendWorkflowExecution } = await import("@/inngest/utils");
        await sendWorkflowExecution({
          workflowId: data.workflowId,
          triggerType: "WEBHOOK_EXTERNAL",
          initialData: {
            ...data.payload,
            organizationId: data.organizationId,
            trackingId: data.trackingId ?? null,
          },
        });
        return { dispatched: true };
      } catch (err) {
        console.error("[webhook-external]", data.workflowId, err);
        return { dispatched: false, status: "FAILED" };
      }
    });
  },
);
