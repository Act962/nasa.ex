/**
 * Inngest functions que disparam workflows do Modo Agente IA a partir dos
 * trigger types do agente: PAYMENT_RECEIVED, MESSAGE_INCOMING, WEBHOOK_EXTERNAL
 * e COMPLIANCE_ITEM_DUE.
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

// ─── COMPLIANCE_ITEM_DUE ───────────────────────────
// Prazo fiscal, documento ou apuração da aba Contábil pedindo atenção (spec 0051).
// Quem publica: `broadcastComplianceItemDue` (cron detect-compliance-due).
// Filtro do nó: `itemKinds` (vazio = todos) e `daysBefore` (vazio = todos;
// -1 casa com qualquer item já vencido). Variáveis: {{trigger.compliance.*}}.

interface ComplianceItemDueEventData {
  organizationId: string;
  itemKind: string;
  code: string;
  label: string;
  dueDate: string;
  daysBefore: number;
  amountCents: number | null;
  entityKey: string;
}

const OVERDUE_FILTER_VALUE = -1;

function readNumberList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function matchesComplianceTriggerFilter(
  nodeData: Record<string, unknown> | null,
  event: Pick<ComplianceItemDueEventData, "itemKind" | "daysBefore">,
): boolean {
  const itemKinds = readStringList(nodeData?.itemKinds);
  if (itemKinds.length > 0 && !itemKinds.includes(event.itemKind)) return false;
  const daysBeforeOptions = readNumberList(nodeData?.daysBefore);
  if (daysBeforeOptions.length === 0) return true;
  if (event.daysBefore < 0) return daysBeforeOptions.includes(OVERDUE_FILTER_VALUE);
  return daysBeforeOptions.includes(event.daysBefore);
}

function formatComplianceAmount(amountCents: number | null): string {
  if (amountCents === null) return "";
  return (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatComplianceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

export const agentTriggerComplianceItemDueFn = inngest.createFunction(
  {
    id: "agent-trigger-compliance-item-due",
    concurrency: { limit: 5 },
  },
  { event: "agent-workflow/compliance-item-due" },
  async ({ event, step }) => {
    const data = event.data as ComplianceItemDueEventData;

    return await step.run("dispatch-workflows", async () => {
      const workflows = await prisma.workflow.findMany({
        where: {
          agentMode: true,
          isActive: true,
          tracking: { organizationId: data.organizationId },
          nodes: { some: { type: "COMPLIANCE_ITEM_DUE" } },
        },
        select: {
          id: true,
          userId: true,
          leadId: true,
          nodes: { where: { type: "COMPLIANCE_ITEM_DUE" }, select: { data: true } },
        },
      });

      const matching = workflows.filter((workflow) =>
        workflow.nodes.some((node) =>
          matchesComplianceTriggerFilter(node.data as Record<string, unknown> | null, data),
        ),
      );

      const compliance = {
        itemKind: data.itemKind,
        code: data.code,
        label: data.label,
        dueDate: formatComplianceDate(data.dueDate),
        dueDateIso: data.dueDate,
        daysBefore: data.daysBefore,
        amount: formatComplianceAmount(data.amountCents),
        amountCents: data.amountCents,
      };

      let dispatched = 0;
      for (const workflow of matching) {
        try {
          // Mesmo evento do `sendWorkflowExecution`; o tipo `WorkflowTriggerType`
          // de inngest/utils ainda não lista este gatilho.
          await inngest.send({
            name: "workflow/execute.workflow",
            data: {
              workflowId: workflow.id,
              triggerType: "COMPLIANCE_ITEM_DUE",
              leadId: workflow.leadId,
              initialData: {
                compliance,
                workflowOwnerId: workflow.userId,
                organizationId: data.organizationId,
              },
            },
          });
          dispatched++;
        } catch (error) {
          console.error("[agent-trigger:compliance-item-due]", workflow.id, error);
        }
      }

      return { matched: matching.length, dispatched };
    });
  },
);
