import "server-only";
import { getUserAppPermissions } from "@/features/permissions/server/app-permission";
import prisma from "@/lib/prisma";

// Quem pode ler e gravar um fluxo: membro da empresa dona do funil (ou do workspace) do fluxo.
// Sem isto, bastava estar logado e ter o id de um fluxo de outra empresa (spec 0092, etapa 0).

export async function canAccessWorkflow(workflowId: string, userId: string): Promise<boolean> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: {
      userId: true,
      tracking: { select: { organizationId: true } },
      workspace: { select: { organizationId: true } },
    },
  });
  if (!workflow) return false;
  const organizationId = workflow.tracking?.organizationId ?? workflow.workspace?.organizationId;
  // Fluxo solto, sem funil nem workspace: só quem criou.
  if (!organizationId) return workflow.userId === userId;
  const membership = await prisma.member.findFirst({ where: { organizationId, userId }, select: { id: true } });
  return Boolean(membership);
}

/** Quem pode mexer nas pastas de fluxos de um funil: membro da empresa dona do funil. */
export async function canAccessTracking(trackingId: string, userId: string): Promise<boolean> {
  const tracking = await prisma.tracking.findUnique({ where: { id: trackingId }, select: { organizationId: true } });
  if (!tracking) return false;
  const membership = await prisma.member.findFirst({ where: { organizationId: tracking.organizationId, userId }, select: { id: true } });
  return Boolean(membership);
}

// ── Permissão fina de Automações (spec 0092) ─────────────────────────────────────────────────
// Além de ser da empresa, a pessoa precisa da permissão de Automações que o Master configura em
// Configurações › Permissões: "Tracking (Automações)" para fluxo de funil, "Workspace (Automações)"
// para fluxo de workspace.

export type AutomationAction = "canView" | "canCreate" | "canEdit" | "canDelete";

/** `not-found` para quem é de fora (não revela que o registro existe); `forbidden` para membro sem a permissão. */
export type AutomationAccess = "allowed" | "not-found" | "forbidden";

export const AUTOMATION_DENIAL: Record<AutomationAction, string> = {
  canView: "Você não tem permissão para ver as automações. Peça ao Master da empresa em Configurações › Permissões.",
  canCreate: "Você não tem permissão para criar automações. Peça ao Master da empresa em Configurações › Permissões.",
  canEdit: "Você não tem permissão para editar automações. Peça ao Master da empresa em Configurações › Permissões.",
  canDelete: "Você não tem permissão para excluir automações. Peça ao Master da empresa em Configurações › Permissões.",
};

async function checkOrganizationAutomations(
  organizationId: string,
  userId: string,
  appKey: "tracking-automacoes" | "workspace-automacoes",
  action: AutomationAction,
): Promise<AutomationAccess> {
  // `null` = não é membro da empresa.
  const permissions = await getUserAppPermissions(organizationId, userId, appKey);
  if (!permissions) return "not-found";
  return permissions[action] ? "allowed" : "forbidden";
}

export async function checkWorkflowAccess(workflowId: string, userId: string, action: AutomationAction): Promise<AutomationAccess> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: {
      userId: true,
      tracking: { select: { organizationId: true } },
      workspace: { select: { organizationId: true } },
    },
  });
  if (!workflow) return "not-found";
  if (workflow.tracking) return checkOrganizationAutomations(workflow.tracking.organizationId, userId, "tracking-automacoes", action);
  if (workflow.workspace) return checkOrganizationAutomations(workflow.workspace.organizationId, userId, "workspace-automacoes", action);
  // Fluxo solto, sem funil nem workspace: só quem criou.
  return workflow.userId === userId ? "allowed" : "not-found";
}

export async function checkTrackingAutomationsAccess(trackingId: string, userId: string, action: AutomationAction): Promise<AutomationAccess> {
  const tracking = await prisma.tracking.findUnique({ where: { id: trackingId }, select: { organizationId: true } });
  if (!tracking) return "not-found";
  return checkOrganizationAutomations(tracking.organizationId, userId, "tracking-automacoes", action);
}

