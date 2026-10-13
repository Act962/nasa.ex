import "server-only";
import prisma from "@/lib/prisma";
import { dispatchLeadTagged } from "@/inngest/utils";
import { findLeadTaggedMatchingWorkflows } from "@/features/triggers/components/lead-tagged/find-matching-workflows";
import { getLastLeadMessage } from "@/features/tracking-executions/lib/lead-message";

// Tags das respostas de um formulário disparam os fluxos "Lead com Tag" do funil do lead (spec 0100, RF-2).
// Roda sempre depois do commit do envio: é I/O de rede e lê com o cliente global.

/** Desligado por padrão: empresas com formulário e fluxo na mesma tag não passam a receber disparos sem aviso. */
export function isFormAnswerTagDispatchOn(): boolean {
  return process.env.FORM_ANSWER_TAGS_TRIGGER_FLOWS === "true";
}

export async function dispatchFormAnswerTagFlows(params: { leadId: string; answerTagIds: string[] }): Promise<{ started: number }> {
  if (!isFormAnswerTagDispatchOn() || params.answerTagIds.length === 0) return { started: 0 };

  // Os ids vêm do envio público: só valem as tags que o envio de fato gravou neste lead.
  const appliedTags = await prisma.leadTag.findMany({
    where: { leadId: params.leadId, tagId: { in: params.answerTagIds } },
    select: { tagId: true },
  });
  const appliedTagIds = appliedTags.map((leadTag) => leadTag.tagId);
  if (appliedTagIds.length === 0) return { started: 0 };

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) return { started: 0 };

  const workflows = await findLeadTaggedMatchingWorkflows({ trackingId: lead.trackingId, tagIds: appliedTagIds });
  if (workflows.length === 0) return { started: 0 };

  const leadMessage = await getLastLeadMessage(lead.id);
  await Promise.all(workflows.map((workflow) => dispatchLeadTagged({ workflowId: workflow.id, lead, tagIds: appliedTagIds, leadMessage })));
  return { started: workflows.length };
}
