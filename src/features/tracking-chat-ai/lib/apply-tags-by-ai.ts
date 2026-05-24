import prisma from "@/lib/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { findLeadTaggedMatchingWorkflows } from "@/features/triggers/components/lead-tagged/find-matching-workflows";

export interface ApplyTagsByAiInput {
  leadId: string;
  tagIds: string[];
}

export interface ApplyTagsByAiResult {
  added: number;
}

/**
 * Adiciona tags ao lead a partir da IA do atendimento.
 *
 * Diferenças vs `addTagsToLead` (router humano em src/app/router/leads/add-tags.ts):
 *   - Sem `recordLeadHistory`, `recordLeadEvent`, `logActivity` — esses três
 *     dependem de `userId` humano. Auditoria de ações da IA está pendente
 *     (ver PROGRESS.md, dívida técnica).
 *   - Mantém o essencial: cria LeadTag, dispara workflows com gatilho
 *     LEAD_TAGGED que casem com `tagIds`, e publica `lead.tag_added` no
 *     event bus (alertas).
 *
 * O match de workflows vive em `findLeadTaggedMatchingWorkflows` —
 * mesmo helper consumido pelo router humano.
 */
export async function applyTagsByAi(
  input: ApplyTagsByAiInput,
): Promise<ApplyTagsByAiResult> {
  if (input.tagIds.length === 0) {
    return { added: 0 };
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: input.leadId },
  });

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.leadTag.createMany({
      data: input.tagIds.map((tagId) => ({
        leadId: input.leadId,
        tagId,
      })),
      skipDuplicates: true,
    });

    const workflows = await findLeadTaggedMatchingWorkflows({
      tx,
      trackingId: lead.trackingId,
      tagIds: input.tagIds,
    });

    return { count: created.count, workflows };
  });

  if (result.workflows.length > 0) {
    await Promise.all(
      result.workflows.map((workflow) =>
        sendWorkflowExecution({
          workflowId: workflow.id,
          initialData: { lead },
        }),
      ),
    );
  }

  const tracking = await prisma.tracking.findUnique({
    where: { id: lead.trackingId },
    select: { organizationId: true },
  });

  if (tracking) {
    await Promise.all(
      input.tagIds.map((tagId) =>
        eventBus.publish("lead.tag_added", {
          leadId: lead.id,
          tagId,
          orgId: tracking.organizationId,
          responsibleId: lead.responsibleId ?? null,
        }),
      ),
    );
  }

  return { added: result.count };
}
