import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { parseAttendanceEntry } from "@/features/attendance-flows/lib/entry-rules";
import { FLOW_TEMPLATES } from "@/features/attendance-flows/lib/flow-templates";
import { buildBlockCatalog, fromMcpBlocks, toMcpBlocks, warningsOfStoredFlow, type McpBlock } from "@/features/attendance-flows/lib/mcp-format";
import { trackingIdsOfFlow } from "@/features/attendance-flows/server/flow-scope";
import { createAttendanceFlow, setAttendanceFlowActive, setAttendanceFlowNumbers } from "@/features/attendance-flows/server/flow-commands";
import { saveWorkflowGraph } from "@/features/workflows/server/save-workflow-graph";
import { checkOrganizationAttendanceAccess, type AutomationAction } from "@/features/workflows/server/workflow-access";
import prisma from "@/lib/prisma";
import { takeRateLimit } from "@/lib/rate-limit";
import { FLOWASTRO_SCOPE, type ExternalAiCaller } from "../access-tokens";
import { asResult, type ToolResult } from "./trafego-mcp-tools";

// FlowAstro pelo MCP (spec 0142): a IA da pessoa monta, revisa e liga fluxos com as permissões que ela tem na tela.

const RATE_LIMIT = { max: 300, windowMs: 60 * 60 * 1000 };
const TAGS_PER_ORGANIZATION = 200;
const FLOWS_LISTED = 200;
const FLOW_TEMPLATE_KEYS = FLOW_TEMPLATES.map((template) => template.key) as [(typeof FLOW_TEMPLATES)[number]["key"], ...(typeof FLOW_TEMPLATES)[number]["key"][]];

const asError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

/** Empresas em que a pessoa tem a permissão de Automações do Tracking (a da tela). Na chave, só as gravadas nela. */
async function listAttendanceOrganizationIds(userId: string, action: AutomationAction, keyOrganizationIds?: string[]): Promise<string[]> {
  const memberships = await prisma.member.findMany({ where: { userId }, select: { organizationId: true } });
  const candidates = memberships.map((membership) => membership.organizationId).filter((id) => !keyOrganizationIds || keyOrganizationIds.includes(id));
  const accesses = await Promise.all(candidates.map((organizationId) => checkOrganizationAttendanceAccess(organizationId, userId, action)));
  return candidates.filter((_, index) => accesses[index] === "allowed");
}

/** O app aparece no MCP se a pessoa pode ver Automações em alguma empresa: para no primeiro "sim". */
export async function hasAnyAttendanceOrganization(userId: string): Promise<boolean> {
  const memberships = await prisma.member.findMany({ where: { userId }, select: { organizationId: true } });
  for (const membership of memberships) {
    if ((await checkOrganizationAttendanceAccess(membership.organizationId, userId, "canView")) === "allowed") return true;
  }
  return false;
}

function organizationsOf(caller: ExternalAiCaller, action: AutomationAction): Promise<string[]> {
  return listAttendanceOrganizationIds(caller.userId, action, caller.credential === "key" ? caller.organizationIds : undefined);
}

async function assertOrganization(caller: ExternalAiCaller, organizationId: string, action: AutomationAction): Promise<void> {
  const isOutsideKey = caller.credential === "key" && !caller.organizationIds.includes(organizationId);
  if (isOutsideKey || (await checkOrganizationAttendanceAccess(organizationId, caller.userId, action)) !== "allowed") {
    throw new Error("Empresa não encontrada, ou você não tem permissão de Automações nela (Configurações › Permissões).");
  }
}

async function loadFlow(caller: ExternalAiCaller, flowId: string, action: AutomationAction) {
  const flow = await prisma.workflow.findFirst({
    where: { id: flowId, kind: "ATTENDANCE" },
    select: { id: true, name: true, isActive: true, organizationId: true, updatedAt: true, trackingId: true, trackingLinks: { select: { trackingId: true } } },
  });
  if (!flow?.organizationId) throw new Error("Fluxo não encontrado.");
  await assertOrganization(caller, flow.organizationId, action);
  return { ...flow, organizationId: flow.organizationId };
}

async function loadGraph(workflowId: string) {
  const [nodes, connections] = await Promise.all([
    prisma.node.findMany({ where: { workflowId }, select: { id: true, type: true, data: true, position: true }, orderBy: { createdAt: "asc" } }),
    prisma.connection.findMany({ where: { workflowId }, select: { fromNodeId: true, toNodeId: true, fromOutput: true } }),
  ]);
  return {
    nodes: nodes.map((node) => ({ id: node.id, type: String(node.type), data: node.data, position: (node.position ?? undefined) as { x: number; y: number } | undefined })),
    connections,
  };
}

async function actorOf(caller: ExternalAiCaller) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: caller.userId }, select: { name: true, email: true, image: true } });
  return { userId: caller.userId, userName: user.name, userEmail: user.email, userImage: user.image };
}

async function logFlowActivity(caller: ExternalAiCaller, params: { organizationId: string; action: string; label: string; flowId: string; flowName: string }) {
  const actor = await actorOf(caller);
  await logActivity({
    organizationId: params.organizationId,
    userId: actor.userId,
    userName: actor.userName,
    userEmail: actor.userEmail,
    appSlug: "flowastro",
    action: params.action,
    actionLabel: `${params.label} "${params.flowName}" pela IA (${caller.label})`,
    resource: params.flowName,
    resourceId: params.flowId,
    metadata: { via: caller.label, credential: caller.credential },
  }).catch((error: unknown) => console.warn("[mcp/flowastro] activity log failed", error));
}

/** Grava os blocos da IA no fluxo, pelo mesmo salvamento do editor (D-3). */
async function saveBlocks(caller: ExternalAiCaller, flowId: string, blocks: McpBlock[], expectedVersion?: string) {
  const previous = await loadGraph(flowId);
  const converted = fromMcpBlocks(blocks, previous.nodes);
  if (!converted.ok) throw new Error(converted.error);
  const saved = await saveWorkflowGraph({ workflowId: flowId, nodes: converted.graph.nodes, edges: converted.graph.edges, actor: await actorOf(caller), expectedVersion });
  const warnings = [...converted.warnings];
  if (saved.entryConflict) warnings.unshift(`O bloco inicial não mudou: ${saved.entryConflict.message}`);
  return { version: saved.version, warnings };
}

async function runFlowTool(caller: ExternalAiCaller, work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    if (!caller.scopes.includes(FLOWASTRO_SCOPE)) {
      return asError("Esta chave não tem acesso ao FlowAstro. Gere uma chave nova em Satélites › IA externa ou conecte pelo OAuth.");
    }
    const limit = takeRateLimit("mcp-flowastro", `${caller.userId}:${caller.tokenId}`, RATE_LIMIT);
    if (!limit.allowed) return asError(`Muitas chamadas seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
    return asResult(await work());
  } catch (error) {
    return asError(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

const blockSchema = z.object({
  id: z.string().describe("Apelido do bloco, único no fluxo (letras, números, _ e -)"),
  type: z.string().describe("Tipo do catálogo: start, message, question, condition, aiAgent..."),
  data: z.record(z.string(), z.unknown()).optional().describe("Configuração do bloco, no formato do catálogo"),
  next: z.record(z.string(), z.string()).optional().describe('Saída → apelido do próximo bloco. Ex.: {"main": "pergunta"} ou {"btn:promo": "inscricao"}'),
});

export function registerFlowAstroMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "flowastro_list_numbers",
    {
      description: "Empresas e números de WhatsApp em que você pode montar fluxo, com as colunas de cada número e as etiquetas da empresa. Comece por aqui.",
      inputSchema: {},
    },
    () =>
      runFlowTool(caller, async () => {
        const organizationIds = await organizationsOf(caller, "canView");
        const organizations = await prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: {
            id: true,
            name: true,
            trackings: { select: { id: true, name: true, status: { select: { id: true, name: true }, orderBy: { order: "asc" } } }, orderBy: { name: "asc" } },
          },
        });
        // Uma consulta por empresa: o limite vale para cada uma, sem uma empresa com muitas etiquetas esconder as outras.
        const tagsByOrganization = new Map(
          await Promise.all(
            organizationIds.map(
              async (organizationId) =>
                [
                  organizationId,
                  await prisma.tag.findMany({ where: { organizationId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: TAGS_PER_ORGANIZATION }),
                ] as const,
            ),
          ),
        );
        return organizations.map((organization) => ({
          organizationId: organization.id,
          name: organization.name,
          numbers: organization.trackings.map((tracking) => ({ trackingId: tracking.id, name: tracking.name, columns: tracking.status })),
          tags: tagsByOrganization.get(organization.id) ?? [],
        }));
      }),
  );

  server.registerTool(
    "flowastro_get_block_catalog",
    {
      description: "Como montar um fluxo: cada tipo de bloco, o formato do data com exemplo, as saídas de cada um, as variáveis e as regras de entrada. Leia antes de criar ou editar.",
      inputSchema: {},
    },
    () => runFlowTool(caller, async () => buildBlockCatalog()),
  );

  server.registerTool(
    "flowastro_list_flows",
    {
      description: "Fluxos da empresa: nome, entrada, números, se está ligado, quantos clientes estão dentro agora e a version.",
      inputSchema: { organizationId: z.string() },
    },
    ({ organizationId }) =>
      runFlowTool(caller, async () => {
        await assertOrganization(caller, organizationId, "canView");
        const flows = await prisma.workflow.findMany({
          where: { organizationId, kind: "ATTENDANCE" },
          select: {
            id: true,
            name: true,
            isActive: true,
            updatedAt: true,
            trackingId: true,
            trackingLinks: { select: { trackingId: true, tracking: { select: { name: true } } } },
            nodes: { where: { type: "ATTENDANCE_START" }, select: { data: true }, take: 1 },
            _count: { select: { runs: { where: { attendanceLeadId: { not: null } } } } },
          },
          orderBy: { updatedAt: "desc" },
          take: FLOWS_LISTED,
        });
        return flows.map((flow) => ({
          flowId: flow.id,
          name: flow.name,
          isActive: flow.isActive,
          entry: parseAttendanceEntry(flow.nodes[0]?.data),
          numbers: flow.trackingLinks.map((link) => ({ trackingId: link.trackingId, name: link.tracking.name })),
          leadsInside: flow._count.runs,
          version: flow.updatedAt.toISOString(),
        }));
      }),
  );

  server.registerTool(
    "flowastro_get_flow",
    {
      description: "O fluxo no formato de blocos {id, type, data, next}, com a version (obrigatória em flowastro_update_flow) e os avisos do que falta.",
      inputSchema: { flowId: z.string() },
    },
    ({ flowId }) =>
      runFlowTool(caller, async () => {
        const flow = await loadFlow(caller, flowId, "canView");
        const graph = await loadGraph(flow.id);
        return {
          flowId: flow.id,
          name: flow.name,
          isActive: flow.isActive,
          numbers: trackingIdsOfFlow(flow),
          version: flow.updatedAt.toISOString(),
          blocks: toMcpBlocks(graph.nodes, graph.connections),
          warnings: warningsOfStoredFlow(graph.nodes, graph.connections),
        };
      }),
  );

  server.registerTool(
    "flowastro_create_flow",
    {
      description:
        "Cria um fluxo DESLIGADO e sem número: em branco, por modelo (template) ou já com os blocos. Devolve o flowId, a version e os avisos. O desenho fica organizado no editor.",
      inputSchema: {
        organizationId: z.string(),
        name: z.string().trim().min(1).max(120),
        template: z.enum(FLOW_TEMPLATE_KEYS).optional().describe(FLOW_TEMPLATES.map((template) => `${template.key}: ${template.description}`).join(" | ")),
        blocks: z.array(blockSchema).optional().describe("Desenho completo; ignora o template"),
      },
    },
    ({ organizationId, name, template, blocks }) =>
      runFlowTool(caller, async () => {
        await assertOrganization(caller, organizationId, "canCreate");
        // Desenho inválido não pode deixar um fluxo vazio para trás: converte antes de criar.
        if (blocks) {
          const preview = fromMcpBlocks(blocks, []);
          if (!preview.ok) throw new Error(preview.error);
        }
        const created = await createAttendanceFlow({ organizationId, userId: caller.userId, name, template: blocks ? "blank" : (template ?? "blank") });
        let result = { version: created.updatedAt.toISOString(), warnings: [] as string[] };
        if (blocks) {
          try {
            result = await saveBlocks(caller, created.id, blocks);
          } catch (error) {
            // O fluxo acabou de nascer, desligado e sem ninguém dentro: sem o desenho, ele não fica para trás.
            await prisma.workflow.delete({ where: { id: created.id } }).catch((cleanupError: unknown) => console.warn("[mcp/flowastro] limpeza do fluxo falhou", cleanupError));
            throw error;
          }
        }
        await logFlowActivity(caller, { organizationId, action: "attendance_flow.created", label: "Criou o fluxo de atendimento", flowId: created.id, flowName: created.name });
        return { flowId: created.id, name: created.name, isActive: false, ...result, editorPath: `/flowastro/${created.id}` };
      }),
  );

  server.registerTool(
    "flowastro_update_flow",
    {
      description:
        "Troca o desenho inteiro do fluxo pelos blocos enviados. Mande todos os blocos, não só os que mudaram (o que ficar de fora é apagado). Exige a version lida em flowastro_get_flow: se alguém salvou depois, recusa.",
      inputSchema: { flowId: z.string(), version: z.string(), blocks: z.array(blockSchema).min(1) },
    },
    ({ flowId, version, blocks }) =>
      runFlowTool(caller, async () => {
        const flow = await loadFlow(caller, flowId, "canEdit");
        const result = await saveBlocks(caller, flow.id, blocks, version);
        await logFlowActivity(caller, { organizationId: flow.organizationId, action: "attendance_flow.updated", label: "Editou o fluxo de atendimento", flowId: flow.id, flowName: flow.name });
        return { flowId: flow.id, isActive: flow.isActive, ...result };
      }),
  );

  server.registerTool(
    "flowastro_rename_flow",
    {
      description: "Muda o nome do fluxo.",
      inputSchema: { flowId: z.string(), name: z.string().trim().min(1).max(120) },
    },
    ({ flowId, name }) =>
      runFlowTool(caller, async () => {
        const flow = await loadFlow(caller, flowId, "canEdit");
        const renamed = await prisma.workflow.update({ where: { id: flow.id }, data: { name }, select: { id: true, name: true, updatedAt: true } });
        await logFlowActivity(caller, { organizationId: flow.organizationId, action: "attendance_flow.renamed", label: `Renomeou "${flow.name}" para`, flowId: flow.id, flowName: name });
        return { flowId: renamed.id, name: renamed.name, version: renamed.updatedAt.toISOString() };
      }),
  );

  server.registerTool(
    "flowastro_set_numbers",
    {
      description: "Escolhe os números (trackingId de flowastro_list_numbers) em que o fluxo responde. Lista vazia tira de todos.",
      inputSchema: { flowId: z.string(), trackingIds: z.array(z.string()).max(50) },
    },
    ({ flowId, trackingIds }) =>
      runFlowTool(caller, async () => {
        const flow = await loadFlow(caller, flowId, "canEdit");
        const result = await setAttendanceFlowNumbers({ workflowId: flow.id, organizationId: flow.organizationId, trackingIds });
        await logFlowActivity(caller, { organizationId: flow.organizationId, action: "attendance_flow.numbers_changed", label: "Trocou os números do fluxo", flowId: flow.id, flowName: flow.name });
        return { flowId: flow.id, ...result };
      }),
  );

  server.registerTool(
    "flowastro_set_active",
    {
      description:
        "Liga ou desliga o fluxo. Ligado, ele responde clientes reais no mesmo minuto: só ligue depois de mostrar o desenho e os números ao usuário e ele confirmar nesta conversa. Desligar tira do fluxo os clientes que estavam dentro.",
      inputSchema: { flowId: z.string(), isActive: z.boolean() },
    },
    ({ flowId, isActive }) =>
      runFlowTool(caller, async () => {
        const flow = await loadFlow(caller, flowId, "canEdit");
        const result = await setAttendanceFlowActive({ workflowId: flow.id, isActive });
        if (result.changed) {
          await logFlowActivity(caller, {
            organizationId: flow.organizationId,
            action: isActive ? "attendance_flow.activated" : "attendance_flow.deactivated",
            label: isActive ? "Ligou o fluxo de atendimento" : "Desligou o fluxo de atendimento",
            flowId: flow.id,
            flowName: flow.name,
          });
        }
        return { flowId: flow.id, isActive: result.isActive };
      }),
  );
}
