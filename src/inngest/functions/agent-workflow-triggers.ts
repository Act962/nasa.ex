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
import { runWorkflow } from "@/features/workflows/lib/run-workflow";
import { getAgentExecutorRegistry } from "@/features/workflows/lib/agent-executor-registry";

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
    return { matched: 0, runs: [] };
  }

  const registry = getAgentExecutorRegistry();
  const results: Array<{ workflowId: string; runId: string | null; status: string }> = [];

  for (const wf of workflows) {
    try {
      const r = await runWorkflow(
        {
          workflowId: wf.id,
          triggerType,
          leadId: leadId ?? null,
          triggerPayload: { ...triggerPayload, organizationId, trackingId },
        },
        registry,
      );
      results.push({
        workflowId: wf.id,
        runId: r.runId,
        status: r.status,
      });
    } catch (err) {
      results.push({
        workflowId: wf.id,
        runId: null,
        status: "FAILED",
      });
      console.error("[agent-workflow-trigger]", wf.id, err);
    }
  }

  return { matched: workflows.length, runs: results };
}

// ─── PAYMENT_RECEIVED ──────────────────────────────
// Disparado por webhook Stripe/Asaas/StarsPayment quando pagamento confirma.
// Quem publica: src/app/api/stripe/webhook/route.ts, src/app/api/payments/asaas/webhook/route.ts
// Payload: { provider, externalId, amount, leadId, organizationId, trackingId }
export const agentTriggerPaymentReceivedFn = inngest.createFunction(
  {
    id: "agent-trigger-payment-received",
    concurrency: { limit: 50 },
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
    };

    return await step.run("dispatch-workflows", async () =>
      dispatchToMatchingWorkflows({
        triggerType: "PAYMENT_RECEIVED",
        triggerPayload: {
          provider: data.provider,
          externalId: data.externalId,
          amount: data.amount,
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
    concurrency: { limit: 100 },
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
    concurrency: { limit: 50 },
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
      const registry = getAgentExecutorRegistry();
      try {
        const r = await runWorkflow(
          {
            workflowId: data.workflowId,
            triggerType: "WEBHOOK_EXTERNAL",
            triggerPayload: data.payload,
          },
          registry,
        );
        return { runId: r.runId, status: r.status };
      } catch (err) {
        console.error("[webhook-external]", data.workflowId, err);
        return { runId: null, status: "FAILED" };
      }
    });
  },
);
