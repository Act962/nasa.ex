import "server-only";
import prisma from "@/lib/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { isMetaInteractiveOn } from "@/features/workflows/lib/button-reply-flow";
import { MENU_OPTION_REPEAT_WINDOW_MS, MENU_OPTION_TRIGGER, findMenuOptionBranches } from "@/features/workflows/lib/menu-option-outputs";

// Toque numa opção de menu salvo (spec 0098): roda os passos que o fluxo tem ligados àquela opção.
// O id do toque vem de fora: quem chama já conferiu que a opção é de um menu ativo deste funil, e
// aqui só entram fluxos ligados do mesmo funil. Falha aqui não pode impedir a resposta ao cliente.

export async function dispatchMenuOptionBranches(params: {
  trackingId: string;
  organizationId: string;
  leadId: string;
  menuId: string;
  optionId: string;
}): Promise<{ started: number }> {
  if (!isMetaInteractiveOn()) return { started: 0 };
  const flows = await prisma.workflow.findMany({
    where: { trackingId: params.trackingId, isActive: true, agentMode: true, tracking: { organizationId: params.organizationId }, nodes: { some: { type: "SEND_MESSAGE" } } },
    select: { id: true, nodes: { select: { id: true, type: true, data: true } }, connections: { select: { fromNodeId: true, fromOutput: true } } },
  });
  const branches = findMenuOptionBranches({ flows, menuId: params.menuId, optionId: params.optionId });
  let started = 0;
  for (const branch of branches) {
    const recentRun = await prisma.workflowRun.findFirst({
      where: {
        workflowId: branch.workflowId,
        leadId: params.leadId,
        triggerType: MENU_OPTION_TRIGGER,
        startedAt: { gte: new Date(Date.now() - MENU_OPTION_REPEAT_WINDOW_MS) },
        initialContext: { path: ["trigger", "optionId"], equals: params.optionId },
      },
      select: { id: true },
    });
    if (recentRun) continue;
    await sendWorkflowExecution({
      workflowId: branch.workflowId,
      triggerType: MENU_OPTION_TRIGGER,
      leadId: params.leadId,
      initialData: { menuId: params.menuId, optionId: params.optionId },
      startFrom: { nodeId: branch.nodeId, output: branch.output },
    });
    started += 1;
  }
  return { started };
}
