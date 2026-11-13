/**
 * Gatilho COMPLIANCE_ITEM_DUE do Modo Agente IA (prazo fiscal da aba Contábil).
 * MESSAGE_INCOMING e PAYMENT_RECEIVED não passam mais por função própria:
 * a busca dos fluxos roda direto em `features/workflows/lib/agent-trigger-helpers.ts`.
 */
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

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
