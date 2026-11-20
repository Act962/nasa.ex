import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { parseAttendanceEntry } from "@/features/attendance-flows/lib/entry-rules";
import { trackingIdsOfFlow } from "@/features/attendance-flows/server/flow-scope";
import { endAttendanceFlowForLead } from "@/features/attendance-flows/server/lock";
import {
  AUTOMATION_DENIAL,
  checkOrganizationAttendanceAccess,
  checkTrackingAutomationsAccess,
  checkWorkflowAccess,
  type AutomationAccess,
} from "@/features/workflows/server/workflow-access";
import prisma from "@/lib/prisma";
import { FLOW_TEMPLATES } from "@/features/attendance-flows/lib/flow-templates";
import { createAttendanceFlow, FlowCommandError, setAttendanceFlowNumbers } from "@/features/attendance-flows/server/flow-commands";

const FLOW_TEMPLATE_KEYS = FLOW_TEMPLATES.map((template) => template.key) as [(typeof FLOW_TEMPLATES)[number]["key"], ...(typeof FLOW_TEMPLATES)[number]["key"][]];
import { parseAiCapabilities, pickBlockCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";
import { loadAiCapabilityOptions } from "@/features/tracking-chat-ai/server/capability-access";

// FlowAstro — Fluxos de Atendimento da empresa (spec 0139, D-11). Salvar desenho, ativar e apagar usam as procedures
// de `workflow`, que já conferem acesso e, para este tipo, a disputa de entrada (RF-5).

const orgProcedure = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

function assertAccess(access: AutomationAccess, action: keyof typeof AUTOMATION_DENIAL, errors: { NOT_FOUND: (options: { message: string }) => Error; FORBIDDEN: (options: { message: string }) => Error }) {
  if (access === "not-found") throw errors.NOT_FOUND({ message: "Fluxo não encontrado" });
  if (access === "forbidden") throw errors.FORBIDDEN({ message: AUTOMATION_DENIAL[action] });
}

const flowSummarySelect = {
  id: true,
  name: true,
  isActive: true,
  updatedAt: true,
  trackingId: true,
  trackingLinks: { select: { trackingId: true, tracking: { select: { name: true } } } },
  nodes: { where: { type: "ATTENDANCE_START" as const }, select: { data: true }, take: 1 },
  _count: { select: { nodes: true } },
} as const;

/** Teto da lista: a tela filtra e pagina na hora; uma empresa tem dezenas de fluxos, não milhares. */
const MAX_FLOWS_LISTED = 500;

const list = orgProcedure.handler(async ({ context, errors }) => {
  assertAccess(await checkOrganizationAttendanceAccess(context.org.id, context.user.id, "canView"), "canView", errors);
  const listedFlows = await prisma.workflow.findMany({
    where: { organizationId: context.org.id, kind: "ATTENDANCE" },
    select: flowSummarySelect,
    orderBy: { updatedAt: "desc" },
    take: MAX_FLOWS_LISTED + 1,
  });
  const isTruncated = listedFlows.length > MAX_FLOWS_LISTED;
  const flows = listedFlows.slice(0, MAX_FLOWS_LISTED);
  const leadsInside = flows.length
    ? await prisma.workflowRun.groupBy({
        by: ["workflowId"],
        where: { workflowId: { in: flows.map((flow) => flow.id) }, attendanceLeadId: { not: null } },
        _count: { _all: true },
      })
    : [];
  const leadsByFlow = new Map(leadsInside.map((row) => [row.workflowId, row._count._all]));
  return {
    flows: flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      isActive: flow.isActive,
      updatedAt: flow.updatedAt,
      entry: parseAttendanceEntry(flow.nodes[0]?.data),
      numbers: flow.trackingLinks.map((link) => ({ trackingId: link.trackingId, name: link.tracking.name })),
      leadsInside: leadsByFlow.get(flow.id) ?? 0,
      blockCount: flow._count.nodes,
    })),
    isTruncated,
  };
});

/** Números (funis) da empresa que podem receber um fluxo, com as colunas de cada um. */
const numberOptions = orgProcedure.handler(async ({ context, errors }) => {
  assertAccess(await checkOrganizationAttendanceAccess(context.org.id, context.user.id, "canView"), "canView", errors);
  const trackings = await prisma.tracking.findMany({
    where: { organizationId: context.org.id },
    select: { id: true, name: true, status: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });
  return { numbers: trackings.map((tracking) => ({ trackingId: tracking.id, name: tracking.name, columns: tracking.status })) };
});

/** Agendas, formulários, Workspaces e documentos da empresa que o bloco Agente de IA pode liberar (spec 0139, D-14). */
const aiOptions = orgProcedure.handler(async ({ context, errors }) => {
  assertAccess(await checkOrganizationAttendanceAccess(context.org.id, context.user.id, "canView"), "canView", errors);
  return loadAiCapabilityOptions(context.org.id);
});

/** Campanhas ativas da empresa, para os blocos da promoção mostrarem qual vale em cada número (spec 0140, RF-13). */
const campaignStatus = orgProcedure.handler(async ({ context, errors }) => {
  assertAccess(await checkOrganizationAttendanceAccess(context.org.id, context.user.id, "canView"), "canView", errors);
  const campaigns = await prisma.loyaltyCampaign.findMany({
    where: { organizationId: context.org.id, isActive: true },
    select: { id: true, name: true, startsAt: true, endsAt: true, trackingId: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const trackingIds = campaigns.flatMap((campaign) => (campaign.trackingId ? [campaign.trackingId] : []));
  const trackings = trackingIds.length
    ? await prisma.tracking.findMany({ where: { id: { in: trackingIds }, organizationId: context.org.id }, select: { id: true, name: true } })
    : [];
  const numberNameById = new Map(trackings.map((tracking) => [tracking.id, tracking.name]));
  return {
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      numberName: campaign.trackingId ? (numberNameById.get(campaign.trackingId) ?? null) : null,
    })),
  };
});

/** Cópia da IA do funil para o bloco: o bloco passa a valer sozinho, sem ficar preso ao funil. */
const importFunnelAi = orgProcedure.input(z.object({ trackingId: z.string() })).handler(async ({ input, context, errors }) => {
  assertAccess(await checkOrganizationAttendanceAccess(context.org.id, context.user.id, "canEdit"), "canEdit", errors);
  const tracking = await prisma.tracking.findFirst({
    where: { id: input.trackingId, organizationId: context.org.id },
    select: { aiSettings: { select: { assistantName: true, prompt: true, capabilities: true } } },
  });
  if (!tracking) throw errors.NOT_FOUND({ message: "Número não encontrado" });
  if (!tracking.aiSettings) throw errors.BAD_REQUEST({ message: "Este número ainda não tem a IA configurada." });
  return {
    assistantName: tracking.aiSettings.assistantName ?? "",
    prompt: tracking.aiSettings.prompt,
    capabilities: pickBlockCapabilities(parseAiCapabilities(tracking.aiSettings.capabilities)),
  };
});

const get = orgProcedure.input(z.object({ workflowId: z.string() })).handler(async ({ input, context, errors }) => {
  assertAccess(await checkWorkflowAccess(input.workflowId, context.user.id, "canView"), "canView", errors);
  const flow = await prisma.workflow.findFirst({
    where: { id: input.workflowId, kind: "ATTENDANCE" },
    select: flowSummarySelect,
  });
  if (!flow) throw errors.NOT_FOUND({ message: "Fluxo não encontrado" });
  return {
    id: flow.id,
    name: flow.name,
    isActive: flow.isActive,
    trackingIds: trackingIdsOfFlow(flow),
  };
});

const create = orgProcedure
  .input(z.object({ name: z.string().trim().min(1).max(120), template: z.enum(FLOW_TEMPLATE_KEYS).default("blank") }))
  .handler(async ({ input, context, errors }) => {
    assertAccess(await checkOrganizationAttendanceAccess(context.org.id, context.user.id, "canCreate"), "canCreate", errors);
    const workflow = await createAttendanceFlow({ organizationId: context.org.id, userId: context.user.id, name: input.name, template: input.template });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      appSlug: "flowastro",
      action: "attendance_flow.created",
      actionLabel: `Criou o fluxo de atendimento "${workflow.name}"`,
      resource: workflow.name,
      resourceId: workflow.id,
    }).catch((error: unknown) => console.warn("[attendance-flow.create] activity log failed", error));
    return workflow;
  });

const setNumbers = orgProcedure
  .input(z.object({ workflowId: z.string(), trackingIds: z.array(z.string()).max(50) }))
  .handler(async ({ input, context, errors }) => {
    assertAccess(await checkWorkflowAccess(input.workflowId, context.user.id, "canEdit"), "canEdit", errors);
    try {
      return await setAttendanceFlowNumbers({ workflowId: input.workflowId, organizationId: context.org.id, trackingIds: input.trackingIds });
    } catch (error) {
      if (error instanceof FlowCommandError) {
        throw error.kind === "not_found" ? errors.NOT_FOUND({ message: error.message }) : errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }
  });

const duplicate = orgProcedure.input(z.object({ workflowId: z.string() })).handler(async ({ input, context, errors }) => {
  assertAccess(await checkWorkflowAccess(input.workflowId, context.user.id, "canCreate"), "canCreate", errors);
  const source = await prisma.workflow.findFirst({
    where: { id: input.workflowId, kind: "ATTENDANCE" },
    include: { nodes: true, connections: true, trackingLinks: { select: { trackingId: true } } },
  });
  if (!source) throw errors.NOT_FOUND({ message: "Fluxo não encontrado" });
  const newIdByOldId = new Map(source.nodes.map((node) => [node.id, createId()]));
  // A cópia nasce desligada e sem números: senão disputaria a entrada com o original.
  const copy = await prisma.workflow.create({
    data: {
      name: `${source.name} (cópia)`,
      organizationId: context.org.id,
      userId: context.user.id,
      kind: "ATTENDANCE",
      agentMode: true,
      isActive: false,
      nodes: {
        create: source.nodes.map((node) => ({
          id: newIdByOldId.get(node.id),
          type: node.type,
          name: node.name,
          position: node.position ?? {},
          data: node.data ?? {},
        })),
      },
    },
    select: { id: true, name: true },
  });
  await prisma.connection.createMany({
    data: source.connections.flatMap((connection) => {
      const fromNodeId = newIdByOldId.get(connection.fromNodeId);
      const toNodeId = newIdByOldId.get(connection.toNodeId);
      return fromNodeId && toNodeId ? [{ workflowId: copy.id, fromNodeId, toNodeId, fromOutput: connection.fromOutput, toInput: connection.toInput }] : [];
    }),
  });
  return copy;
});

/** Quantos leads estão parados em cada bloco agora (RF-13). */
const leadsByNode = orgProcedure.input(z.object({ workflowId: z.string() })).handler(async ({ input, context, errors }) => {
  assertAccess(await checkWorkflowAccess(input.workflowId, context.user.id, "canView"), "canView", errors);
  const rows = await prisma.workflowRun.groupBy({
    by: ["currentNodeId"],
    where: { workflowId: input.workflowId, attendanceLeadId: { not: null }, currentNodeId: { not: null } },
    _count: { _all: true },
  });
  return { counts: rows.map((row) => ({ nodeId: row.currentNodeId ?? "", leads: row._count._all })) };
});

/** Leads parados num bloco, para a lista que abre ao clicar no contador. */
const leadsInNode = orgProcedure.input(z.object({ workflowId: z.string(), nodeId: z.string() })).handler(async ({ input, context, errors }) => {
  assertAccess(await checkWorkflowAccess(input.workflowId, context.user.id, "canView"), "canView", errors);
  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: input.workflowId, currentNodeId: input.nodeId, attendanceLeadId: { not: null } },
    select: { attendanceLeadId: true },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  const leadIds = runs.flatMap((run) => (run.attendanceLeadId ? [run.attendanceLeadId] : []));
  const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true, phone: true } });
  return { leads };
});

/** Situação do lead no fluxo, para o chat (RF-14). */
const leadStatus = orgProcedure.input(z.object({ leadId: z.string() })).handler(async ({ input, context, errors }) => {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { trackingId: true } });
  if (!lead || (await checkTrackingAutomationsAccess(lead.trackingId, context.user.id, "canView")) !== "allowed") {
    throw errors.NOT_FOUND({ message: "Lead não encontrado" });
  }
  const run = await prisma.workflowRun.findUnique({
    where: { attendanceLeadId: input.leadId },
    select: { workflowId: true, currentNodeId: true, workflow: { select: { name: true } } },
  });
  return { inFlow: run ? { workflowId: run.workflowId, workflowName: run.workflow.name, currentNodeId: run.currentNodeId } : null };
});

const removeLead = orgProcedure.input(z.object({ leadId: z.string() })).handler(async ({ input, context, errors }) => {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { trackingId: true } });
  if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });
  assertAccess(await checkTrackingAutomationsAccess(lead.trackingId, context.user.id, "canEdit"), "canEdit", errors);
  return { removed: await endAttendanceFlowForLead(input.leadId, "removed_by_user") };
});

export const attendanceFlowRoutes = { list, numberOptions, aiOptions, importFunnelAi, campaignStatus, get, create, setNumbers, duplicate, leadsByNode, leadsInNode, leadStatus, removeLead };
