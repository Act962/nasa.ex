import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { getUserAppPermissions } from "@/features/permissions/server/app-permission";
import type { AppPermissions } from "@/features/permissions/lib/app-permission-catalog";

/**
 * Planner multi-cliente (spec 0058, D-1): cada cliente é uma org. Leituras cruzam só as orgs do usuário
 * com permissão no Planner; escritas usam a org do próprio post, nunca a org ativa da sessão.
 */

export const PLANNER_APP_KEY = "nasa-planner";

/** O que cada ação do Planner exige na matriz de Permissões. */
export type PlannerAction = "view" | "create" | "approve" | "schedule";

export function canDoPlannerAction(permissions: AppPermissions | null, action: PlannerAction) {
  if (!permissions) return false;
  switch (action) {
    case "view":
      return permissions.canView;
    case "create":
      return permissions.canCreate;
    case "approve":
      return permissions.canApprove;
    case "schedule":
      return permissions.canEdit || permissions.canApprove;
  }
}

export interface PlannerOrganization {
  id: string;
  name: string;
  logo: string | null;
  permissions: AppPermissions;
}

export async function listPlannerOrganizations(userId: string, action: PlannerAction = "view"): Promise<PlannerOrganization[]> {
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { organization: { select: { id: true, name: true, logo: true } } },
    orderBy: { createdAt: "asc" },
  });
  const organizationsWithPermissions = await Promise.all(
    memberships.map(async ({ organization }) => ({
      ...organization,
      permissions: await getUserAppPermissions(organization.id, userId, PLANNER_APP_KEY),
    })),
  );
  return organizationsWithPermissions.filter(
    (organization): organization is PlannerOrganization => canDoPlannerAction(organization.permissions, action),
  );
}

/** Orgs pedidas ∩ orgs permitidas. Pedir explicitamente uma org sem acesso é FORBIDDEN, não lista vazia. */
export async function resolvePlannerOrganizationIds(userId: string, requestedIds: string[] | undefined, action: PlannerAction = "view") {
  const allowedIds = (await listPlannerOrganizations(userId, action)).map((organization) => organization.id);
  if (!requestedIds || requestedIds.length === 0) return allowedIds;
  const forbiddenId = requestedIds.find((requestedId) => !allowedIds.includes(requestedId));
  if (forbiddenId) throw new ORPCError("FORBIDDEN", { message: "Você não tem acesso ao Planner de um dos clientes escolhidos." });
  return requestedIds;
}

export async function assertPlannerOrganizationAccess(userId: string, organizationId: string, action: PlannerAction) {
  const permissions = await getUserAppPermissions(organizationId, userId, PLANNER_APP_KEY);
  if (!canDoPlannerAction(permissions, action)) {
    throw new ORPCError("FORBIDDEN", { message: "Seu papel não permite esta ação no Planner deste cliente." });
  }
  return permissions!;
}

/** Carrega o post e confere a permissão na org dele. */
export async function assertPostAccess(userId: string, postId: string, action: PlannerAction) {
  const post = await prisma.nasaPlannerPost.findUnique({
    where: { id: postId },
    include: { slides: { orderBy: { order: "asc" } }, planner: { select: { requiresApproval: true, forbiddenWords: true, defaultHashtags: true } } },
  });
  if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });
  const permissions = await assertPlannerOrganizationAccess(userId, post.organizationId, action);
  return { post, permissions };
}

/** Planner padrão da org, criado na primeira vez que alguém cria um post nela (spec 0058, CB-3). */
export async function ensureDefaultPlanner(organizationId: string) {
  const existingPlanner = await prisma.nasaPlanner.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existingPlanner) return existingPlanner.id;
  const createdPlanner = await prisma.nasaPlanner.create({
    data: { organizationId, name: "Planner principal" },
    select: { id: true },
  });
  return createdPlanner.id;
}

/** Aprovação obrigatória (spec 0058, RF-5): o planner decide; sem decisão, vale para org com mais de um membro. */
export async function isApprovalRequired(organizationId: string, plannerRequiresApproval: boolean | null) {
  if (plannerRequiresApproval !== null) return plannerRequiresApproval;
  const memberCount = await prisma.member.count({ where: { organizationId } });
  return memberCount > 1;
}
