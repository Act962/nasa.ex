import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { orderedStepTypes } from "@/features/automations-hub/lib/flow-steps";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { diagnoseFlow, type FlowChannelProvider } from "@/features/workflows/lib/flow-diagnostics";
import prisma from "@/lib/prisma";

// Central de Gatilhos Automáticos (spec 0090, seção A). Só leitura: reúne as automações que a
// pessoa já pode ver em cada App. Nada é migrado e cada item continua abrindo no seu editor.
//
// Tudo é filtrado pela empresa ativa E pelo que a pessoa alcança: trackings em que participa,
// workspaces de que é membro, e a permissão do App na matriz de Configurações › Permissões.

const MAX_ITEMS_PER_ORIGIN = 200;

export type AutomationOrigin = "tracking" | "workspace" | "comments";

export interface HubAutomation {
  id: string;
  name: string;
  isActive: boolean;
  origin: AutomationOrigin;
  /** Nome do tracking, do workspace ou da conta do Comments. */
  originName: string;
  /** Id do tracking ou do workspace; usado para ligar e desligar pela rota de cada um. */
  originId: string;
  href: string;
  channel: "whatsapp" | "instagram" | "facebook" | "workspace";
  stepTypes: string[];
  hasPredictedError: boolean;
  updatedAt: string;
}

export const getAutomationsOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const userId = context.user.id;
    const [canSeeTrackingFlows, canSeeWorkspaceFlows, canSeeComments, canSeeAstro] = await Promise.all([
      hasAppPermission(organizationId, userId, "tracking-automacoes", "canView"),
      hasAppPermission(organizationId, userId, "workspace-automacoes", "canView"),
      hasAppPermission(organizationId, userId, "comments", "canView"),
      hasAppPermission(organizationId, userId, "astro", "canView"),
    ]);

    const [trackings, workspaces] = await Promise.all([
      canSeeTrackingFlows
        ? prisma.tracking.findMany({
            where: { organizationId, participants: { some: { userId } } },
            select: { id: true, name: true, whatsappInstance: { select: { provider: true } } },
            orderBy: { name: "asc" },
          })
        : [],
      canSeeWorkspaceFlows
        ? prisma.workspace.findMany({
            where: { organizationId, members: { some: { userId } } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : [],
    ]);
    const trackingIds = trackings.map((tracking) => tracking.id);
    const workspaceIds = workspaces.map((workspace) => workspace.id);
    const flowSelect = {
      id: true,
      name: true,
      isActive: true,
      updatedAt: true,
      trackingId: true,
      workspaceId: true,
      nodes: { select: { id: true, type: true, data: true } },
      connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } },
    } as const;

    const [trackingFlows, workspaceFlows, socialAutomations, leadTriggers, idleAutomations, astroCommands, alertRules] = await Promise.all([
      trackingIds.length > 0
        ? prisma.workflow.findMany({ where: { trackingId: { in: trackingIds } }, select: flowSelect, orderBy: { updatedAt: "desc" }, take: MAX_ITEMS_PER_ORIGIN })
        : [],
      workspaceIds.length > 0
        ? prisma.workflow.findMany({ where: { workspaceId: { in: workspaceIds } }, select: flowSelect, orderBy: { updatedAt: "desc" }, take: MAX_ITEMS_PER_ORIGIN })
        : [],
      canSeeComments
        ? prisma.socialAutomation.findMany({
            where: { organizationId },
            select: { id: true, name: true, isActive: true, updatedAt: true, channel: { select: { id: true, provider: true } } },
            orderBy: { updatedAt: "desc" },
            take: MAX_ITEMS_PER_ORIGIN,
          })
        : [],
      trackingIds.length > 0 ? prisma.leadTrigger.count({ where: { organizationId, isActive: true, lead: { trackingId: { in: trackingIds } } } }) : 0,
      trackingIds.length > 0
        ? prisma.trackingIdleAutomation.count({ where: { trackingId: { in: trackingIds }, OR: [{ noFirstRespActive: true }, { inConvActive: true }] } })
        : 0,
      canSeeAstro ? prisma.astroCommand.count({ where: { organizationId, status: "ACTIVE" } }) : 0,
      canSeeAstro ? prisma.alertRule.count({ where: { organizationId, isActive: true } }) : 0,
    ]);

    const trackingById = new Map(trackings.map((tracking) => [tracking.id, tracking]));
    const workspaceNameById = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));

    const automations: HubAutomation[] = [
      ...trackingFlows.map((flow): HubAutomation => {
        const tracking = trackingById.get(flow.trackingId ?? "");
        const provider: FlowChannelProvider = !tracking?.whatsappInstance
          ? "none"
          : tracking.whatsappInstance.provider === "META_CLOUD"
            ? "meta"
            : "uazapi";
        const edges = flow.connections.map((connection) => ({
          id: connection.id,
          source: connection.fromNodeId,
          target: connection.toNodeId,
          sourceHandle: connection.fromOutput,
        }));
        return {
          id: flow.id,
          name: flow.name,
          isActive: flow.isActive,
          origin: "tracking",
          originName: tracking?.name ?? "Tracking",
          originId: flow.trackingId ?? "",
          href: `/tracking/${flow.trackingId}/workflows/${flow.id}`,
          channel: "whatsapp",
          stepTypes: orderedStepTypes(flow.nodes, flow.connections),
          hasPredictedError: diagnoseFlow(flow.nodes, edges, { provider }).some((diagnostic) => diagnostic.severity === "error"),
          updatedAt: flow.updatedAt.toISOString(),
        };
      }),
      ...workspaceFlows.map(
        (flow): HubAutomation => ({
          id: flow.id,
          name: flow.name,
          isActive: flow.isActive,
          origin: "workspace",
          originName: workspaceNameById.get(flow.workspaceId ?? "") ?? "Workspace",
          originId: flow.workspaceId ?? "",
          href: `/workspaces/${flow.workspaceId}/automations/${flow.id}`,
          channel: "workspace",
          stepTypes: orderedStepTypes(flow.nodes, flow.connections),
          hasPredictedError: false,
          updatedAt: flow.updatedAt.toISOString(),
        }),
      ),
      ...socialAutomations.map(
        (automation): HubAutomation => ({
          id: automation.id,
          name: automation.name,
          isActive: automation.isActive,
          origin: "comments",
          originName: "Comments",
          originId: automation.channel.id,
          href: `/comments/automations/${automation.id}`,
          channel: String(automation.channel.provider).toUpperCase().includes("FACEBOOK") ? "facebook" : "instagram",
          stepTypes: [],
          hasPredictedError: false,
          updatedAt: automation.updatedAt.toISOString(),
        }),
      ),
    ];

    return {
      automations,
      trackings: trackings.map((tracking) => ({ id: tracking.id, name: tracking.name })),
      shortcuts: {
        leadTriggers: leadTriggers,
        idleAutomations: idleAutomations,
        astroCommands: astroCommands,
        alertRules: alertRules,
      },
      canCreateTrackingFlow: canSeeTrackingFlows && (await hasAppPermission(organizationId, userId, "tracking-automacoes", "canCreate")),
    };
  });
