import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { takeRateLimit } from "@/lib/rate-limit";
import {
  addActionChecklistItem,
  addActionParticipant,
  addActionResponsible,
  addActionTag,
  createWorkspaceAction,
  moveWorkspaceAction,
  removeActionResponsible,
  removeActionTag,
  setWorkspaceActionDone,
  updateWorkspaceAction,
  type ActionActor,
} from "@/features/actions/server/lib/action-commands";
import { resolveActionAccess } from "@/features/actions/server/lib/can-edit-action";
import { WORKSPACE_SCOPE, type ExternalAiCaller } from "../access-tokens";
import { asResult, type ToolResult } from "./trafego-mcp-tools";

// Workspace pelo MCP (spec 0143): a IA da pessoa lê e mexe nos cards com as permissões que ela tem na tela.

const RATE_LIMIT = { max: 300, windowMs: 60 * 60 * 1000 };
const ACTIONS_PER_COLUMN = 50;
const SEARCH_LIMIT = 50;
const PEOPLE_PER_CALL = 20;
const BRAZIL_OFFSET = "-03:00";
const NOT_FOUND_ACTION = "Card não encontrado.";
const NOT_FOUND_WORKSPACE = "Workspace não encontrado, ou você não é membro dele.";

const PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const asError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

interface OrganizationContext {
  id: string;
  members: { userId: string; role: string }[];
  callerRole: string;
}

/** Empresas da pessoa; na chave, só as gravadas nela (RF-1). */
async function listCallerOrganizationIds(caller: ExternalAiCaller): Promise<string[]> {
  const memberships = await prisma.member.findMany({ where: { userId: caller.userId }, select: { organizationId: true } });
  return memberships
    .map((membership) => membership.organizationId)
    .filter((organizationId) => caller.credential !== "key" || caller.organizationIds.includes(organizationId));
}

/** O app aparece no MCP para quem é membro de algum workspace não arquivado. */
export async function hasAnyWorkspaceMembership(userId: string): Promise<boolean> {
  const membership = await prisma.workspaceMember.findFirst({ where: { userId, workspace: { isArchived: false } }, select: { id: true } });
  return membership !== null;
}

async function loadOrganizationContext(caller: ExternalAiCaller, organizationId: string): Promise<OrganizationContext | null> {
  if (caller.credential === "key" && !caller.organizationIds.includes(organizationId)) return null;
  const members = await prisma.member.findMany({ where: { organizationId }, select: { userId: true, role: true } });
  const callerRole = members.find((member) => member.userId === caller.userId)?.role;
  if (!callerRole) return null;
  return { id: organizationId, members, callerRole };
}

/** Workspace em que a pessoa é membro, dentro de uma empresa permitida (RF-2). */
async function loadWorkspace(caller: ExternalAiCaller, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, isArchived: false, members: { some: { userId: caller.userId } } },
    select: { id: true, name: true, organizationId: true, members: { where: { userId: caller.userId }, select: { role: true } } },
  });
  if (!workspace) throw new Error(NOT_FOUND_WORKSPACE);
  const organization = await loadOrganizationContext(caller, workspace.organizationId);
  if (!organization) throw new Error(NOT_FOUND_WORKSPACE);
  return { workspace, organization, workspaceRole: workspace.members[0]?.role };
}

async function loadWritableWorkspace(caller: ExternalAiCaller, workspaceId: string) {
  const loaded = await loadWorkspace(caller, workspaceId);
  if (loaded.workspaceRole === "VIEWER") throw new Error(`Você só pode ver o workspace "${loaded.workspace.name}", não criar ou mover cards nele.`);
  return loaded;
}

/** Papel `member` da empresa vê só os cards que criou ou em que participa, como na tela. */
function visibilityFilter(organization: OrganizationContext, userId: string): Prisma.ActionWhereInput {
  if (organization.callerRole !== "member") return {};
  return { OR: [{ createdBy: userId }, { participants: { some: { userId } } }] };
}

/** Card visível para a pessoa; com `forEdit`, também editável (D-1). */
async function loadAction(caller: ExternalAiCaller, actionId: string, options: { forEdit: boolean }) {
  const action = await prisma.action.findFirst({
    where: { id: actionId, workspace: { isArchived: false, members: { some: { userId: caller.userId } } } },
    select: { id: true, workspaceId: true, workspace: { select: { organizationId: true } } },
  });
  if (!action) throw new Error(NOT_FOUND_ACTION);
  const organization = await loadOrganizationContext(caller, action.workspace.organizationId);
  if (!organization) throw new Error(NOT_FOUND_ACTION);

  const isVisible = await prisma.action.count({ where: { id: actionId, ...visibilityFilter(organization, caller.userId) } });
  if (!isVisible) throw new Error(NOT_FOUND_ACTION);

  if (options.forEdit) {
    const access = await resolveActionAccess(actionId, { userId: caller.userId, org: organization });
    if (!access?.canEdit) throw new Error("Você não tem permissão para mexer neste card: só quem criou, participa, o dono do workspace ou admin da empresa.");
  }
  return { actionId: action.id, workspaceId: action.workspaceId, organization };
}

async function loadActor(caller: ExternalAiCaller): Promise<ActionActor> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: caller.userId }, select: { id: true, name: true, email: true, image: true } });
  return user;
}

async function assertOrganizationMembers(organization: OrganizationContext, userIds: string[]) {
  const memberIds = new Set(organization.members.map((member) => member.userId));
  const outsiders = userIds.filter((userId) => !memberIds.has(userId));
  if (outsiders.length > 0) throw new Error(`Estas pessoas não são da empresa: ${outsiders.join(", ")}. Use os ids de workspace_list_workspaces.`);
}

/** Data ISO da IA. Sem hora, vale o fim do dia no horário de Brasília (RF-7). */
function parseDate(value: string, field: string): Date {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(isDateOnly ? `${value}T23:59:00${BRAZIL_OFFSET}` : value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Data inválida em ${field}: use 2026-11-20 ou 2026-11-20T14:00:00-03:00.`);
  return parsed;
}

const parseOptionalDate = (value: string | null | undefined, field: string) =>
  value === undefined ? undefined : value === null ? null : parseDate(value, field);

const userSummary = { select: { id: true, name: true } } as const;

async function runWorkspaceTool(caller: ExternalAiCaller, work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    if (!caller.scopes.includes(WORKSPACE_SCOPE)) {
      return asError("Esta chave não tem acesso ao Workspace. Gere uma chave nova em Satélites › IA externa ou conecte pelo OAuth.");
    }
    const limit = takeRateLimit("mcp-workspace", `${caller.userId}:${caller.tokenId}`, RATE_LIMIT);
    if (!limit.allowed) return asError(`Muitas chamadas seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
    return asResult(await work());
  } catch (error) {
    return asError(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

const dateField = (description: string) => z.string().describe(`${description}. ISO: 2026-11-20 (fim do dia em Brasília) ou 2026-11-20T14:00:00-03:00`);

export function registerWorkspaceMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "workspace_list_workspaces",
    {
      description: "Empresas e workspaces (quadros de tarefas) de que você é membro, com as colunas, as etiquetas e as pessoas de cada um. Comece por aqui.",
      inputSchema: {},
    },
    () =>
      runWorkspaceTool(caller, async () => {
        const organizationIds = await listCallerOrganizationIds(caller);
        const workspaces = await prisma.workspace.findMany({
          where: { organizationId: { in: organizationIds }, isArchived: false, members: { some: { userId: caller.userId } } },
          select: {
            id: true,
            name: true,
            description: true,
            organization: { select: { id: true, name: true } },
            members: { where: { userId: caller.userId }, select: { role: true } },
            columns: { select: { id: true, name: true }, orderBy: { order: "asc" } },
            tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
          orderBy: { name: "asc" },
        });
        const organizationMembers = await prisma.member.findMany({
          where: { organizationId: { in: [...new Set(workspaces.map((workspace) => workspace.organization.id))] } },
          select: { organizationId: true, user: userSummary },
        });
        return workspaces.map((workspace) => ({
          workspaceId: workspace.id,
          name: workspace.name,
          description: workspace.description,
          organization: workspace.organization,
          yourRole: workspace.members[0]?.role,
          columns: workspace.columns,
          tags: workspace.tags,
          people: organizationMembers.filter((member) => member.organizationId === workspace.organization.id).map((member) => member.user),
        }));
      }),
  );

  server.registerTool(
    "workspace_get_board",
    {
      description: `O quadro do workspace: cada coluna com os cards que você pode ver (até ${ACTIONS_PER_COLUMN} por coluna, os de cima primeiro). Cards arquivados não entram.`,
      inputSchema: {
        workspaceId: z.string(),
        responsibleId: z.string().optional().describe("Só os cards com este responsável"),
        tagId: z.string().optional().describe("Só os cards com esta etiqueta"),
        dueBefore: dateField("Só os cards com prazo até esta data").optional(),
        includeDone: z.boolean().optional().describe("Incluir concluídos (padrão: sim)"),
      },
    },
    ({ workspaceId, responsibleId, tagId, dueBefore, includeDone }) =>
      runWorkspaceTool(caller, async () => {
        const { workspace, organization } = await loadWorkspace(caller, workspaceId);
        const actionWhere: Prisma.ActionWhereInput = {
          isArchived: false,
          ...visibilityFilter(organization, caller.userId),
          ...(responsibleId ? { responsibles: { some: { userId: responsibleId } } } : {}),
          ...(tagId ? { tags: { some: { tagId } } } : {}),
          ...(dueBefore ? { dueDate: { lte: parseDate(dueBefore, "dueBefore") } } : {}),
          ...(includeDone === false ? { isDone: false } : {}),
        };
        const columns = await prisma.workspaceColumn.findMany({
          where: { workspaceId },
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            _count: { select: { actions: { where: actionWhere } } },
            actions: {
              where: actionWhere,
              orderBy: { order: "asc" },
              take: ACTIONS_PER_COLUMN,
              select: {
                id: true,
                title: true,
                priority: true,
                isDone: true,
                dueDate: true,
                responsibles: { select: { user: userSummary } },
                tags: { select: { tag: { select: { id: true, name: true } } } },
              },
            },
          },
        });
        return {
          workspaceId: workspace.id,
          name: workspace.name,
          columns: columns.map((column) => ({
            columnId: column.id,
            name: column.name,
            total: column._count.actions,
            actions: column.actions.map((action) => ({
              actionId: action.id,
              title: action.title,
              priority: action.priority,
              isDone: action.isDone,
              dueDate: action.dueDate,
              responsibles: action.responsibles.map((responsible) => responsible.user),
              tags: action.tags.map((actionTag) => actionTag.tag),
            })),
          })),
        };
      }),
  );

  server.registerTool(
    "workspace_search_actions",
    {
      description: `Busca cards por título em todos os seus workspaces (ou num só). Até ${SEARCH_LIMIT}, os de prazo mais próximo primeiro.`,
      inputSchema: {
        query: z.string().optional().describe("Parte do título"),
        workspaceId: z.string().optional(),
        onlyOverdue: z.boolean().optional().describe("Só os atrasados (prazo passou e não concluído)"),
        includeDone: z.boolean().optional().describe("Incluir concluídos (padrão: não)"),
      },
    },
    ({ query, workspaceId, onlyOverdue, includeDone }) =>
      runWorkspaceTool(caller, async () => {
        const organizationIds = workspaceId ? [(await loadWorkspace(caller, workspaceId)).organization.id] : await listCallerOrganizationIds(caller);
        const organizations = (await Promise.all(organizationIds.map((organizationId) => loadOrganizationContext(caller, organizationId)))).filter(
          (organization): organization is OrganizationContext => organization !== null,
        );
        const actions = await prisma.action.findMany({
          where: {
            isArchived: false,
            ...(workspaceId ? { workspaceId } : {}),
            workspace: { isArchived: false, members: { some: { userId: caller.userId } } },
            OR: organizations.map((organization) => ({ workspace: { organizationId: organization.id }, ...visibilityFilter(organization, caller.userId) })),
            ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
            ...(onlyOverdue ? { isDone: false, dueDate: { lt: new Date() } } : includeDone ? {} : { isDone: false }),
          },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
          take: SEARCH_LIMIT,
          select: {
            id: true,
            title: true,
            priority: true,
            isDone: true,
            dueDate: true,
            workspace: { select: { id: true, name: true } },
            column: { select: { id: true, name: true } },
            responsibles: { select: { user: userSummary } },
          },
        });
        return actions.map((action) => ({
          actionId: action.id,
          title: action.title,
          priority: action.priority,
          isDone: action.isDone,
          dueDate: action.dueDate,
          workspace: action.workspace,
          column: action.column,
          responsibles: action.responsibles.map((responsible) => responsible.user),
        }));
      }),
  );

  server.registerTool(
    "workspace_get_action",
    {
      description: "O card inteiro: descrição, datas, coluna, responsáveis, participantes, etiquetas, checklist e lead ligado.",
      inputSchema: { actionId: z.string() },
    },
    ({ actionId }) =>
      runWorkspaceTool(caller, async () => {
        await loadAction(caller, actionId, { forEdit: false });
        const action = await prisma.action.findUniqueOrThrow({
          where: { id: actionId },
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            isDone: true,
            closedAt: true,
            dueDate: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            user: userSummary,
            workspace: { select: { id: true, name: true } },
            column: { select: { id: true, name: true } },
            responsibles: { select: { user: userSummary } },
            participants: { select: { user: userSummary } },
            tags: { select: { tag: { select: { id: true, name: true } } } },
            subActions: { select: { id: true, title: true, isDone: true, finishDate: true }, orderBy: { order: "asc" } },
            lead: { select: { id: true, name: true } },
          },
        });
        return {
          actionId: action.id,
          title: action.title,
          description: action.description,
          priority: action.priority,
          isDone: action.isDone,
          closedAt: action.closedAt,
          dueDate: action.dueDate,
          startDate: action.startDate,
          endDate: action.endDate,
          createdAt: action.createdAt,
          createdBy: action.user,
          workspace: action.workspace,
          column: action.column,
          responsibles: action.responsibles.map((responsible) => responsible.user),
          participants: action.participants.map((participant) => participant.user),
          tags: action.tags.map((actionTag) => actionTag.tag),
          checklist: action.subActions,
          lead: action.lead,
          openPath: `/workspaces/${action.workspace.id}`,
        };
      }),
  );

  server.registerTool(
    "workspace_create_action",
    {
      description:
        "Cria um card no workspace. Sem coluna, entra no topo da primeira. Responsáveis e participantes recebem aviso de tarefa nova: confirme com o usuário antes de pôr outras pessoas.",
      inputSchema: {
        workspaceId: z.string(),
        title: z.string().trim().min(1).max(200),
        columnId: z.string().optional(),
        description: z.string().max(10_000).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe("Padrão: MEDIUM"),
        dueDate: dateField("Prazo").optional(),
        startDate: dateField("Início").optional(),
        responsibleIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional().describe("Ids de pessoas (de workspace_list_workspaces)"),
        participantIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional().describe("Você já entra como participante"),
      },
    },
    (input) =>
      runWorkspaceTool(caller, async () => {
        const { workspace, organization } = await loadWritableWorkspace(caller, input.workspaceId);
        const columnId =
          input.columnId ?? (await prisma.workspaceColumn.findFirst({ where: { workspaceId: workspace.id }, orderBy: { order: "asc" }, select: { id: true } }))?.id;
        if (!columnId) throw new Error("Este workspace não tem coluna. Crie uma coluna na tela antes.");
        await assertOrganizationMembers(organization, [...(input.responsibleIds ?? []), ...(input.participantIds ?? [])]);

        const action = await createWorkspaceAction({
          organizationId: organization.id,
          actor: await loadActor(caller),
          via: caller.label,
          input: {
            title: input.title,
            description: input.description,
            priority: input.priority ?? "MEDIUM",
            dueDate: input.dueDate ? parseDate(input.dueDate, "dueDate") : undefined,
            startDate: input.startDate ? parseDate(input.startDate, "startDate") : undefined,
            workspaceId: workspace.id,
            columnId,
            participantIds: input.participantIds,
            responsibleIds: input.responsibleIds,
          },
        });
        return { actionId: action.id, title: action.title, columnId, openPath: `/workspaces/${workspace.id}` };
      }),
  );

  server.registerTool(
    "workspace_update_action",
    {
      description: "Muda título, descrição, prioridade e datas do card. Mande só o que muda; null limpa o campo. Para coluna use workspace_move_action, para concluir workspace_set_done.",
      inputSchema: {
        actionId: z.string(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().max(10_000).nullable().optional(),
        priority: z.enum(PRIORITIES).optional(),
        dueDate: dateField("Prazo").nullable().optional(),
        startDate: dateField("Início").nullable().optional(),
        endDate: dateField("Fim").nullable().optional(),
      },
    },
    (input) =>
      runWorkspaceTool(caller, async () => {
        const { organization } = await loadAction(caller, input.actionId, { forEdit: true });
        const action = await updateWorkspaceAction({
          org: organization,
          actor: await loadActor(caller),
          via: caller.label,
          input: {
            actionId: input.actionId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            dueDate: parseOptionalDate(input.dueDate, "dueDate"),
            startDate: parseOptionalDate(input.startDate, "startDate"),
            endDate: parseOptionalDate(input.endDate, "endDate"),
          },
        });
        return { actionId: action.id, title: action.title, priority: action.priority, dueDate: action.dueDate, startDate: action.startDate, endDate: action.endDate };
      }),
  );

  server.registerTool(
    "workspace_move_action",
    {
      description: "Move o card para outra coluna (pode ser de outro workspace seu na mesma empresa). Dispara as automações de \"card movido\" da coluna.",
      inputSchema: { actionId: z.string(), columnId: z.string() },
    },
    ({ actionId, columnId }) =>
      runWorkspaceTool(caller, async () => {
        const { organization } = await loadAction(caller, actionId, { forEdit: true });
        const column = await prisma.workspaceColumn.findFirst({ where: { id: columnId, workspace: { organizationId: organization.id } }, select: { id: true, name: true, workspaceId: true } });
        if (!column) throw new Error("Coluna não encontrada nesta empresa.");
        await loadWritableWorkspace(caller, column.workspaceId);
        await moveWorkspaceAction({ organizationId: organization.id, actor: await loadActor(caller), via: caller.label, actionId, columnId, workspaceId: column.workspaceId });
        return { actionId, column: { id: column.id, name: column.name }, workspaceId: column.workspaceId };
      }),
  );

  server.registerTool(
    "workspace_set_done",
    {
      description: "Conclui (isDone=true) ou reabre (false) o card. Concluir dá os pontos ao criador e dispara as automações de \"card concluído\".",
      inputSchema: { actionId: z.string(), isDone: z.boolean() },
    },
    ({ actionId, isDone }) =>
      runWorkspaceTool(caller, async () => {
        const { organization } = await loadAction(caller, actionId, { forEdit: true });
        const action = await setWorkspaceActionDone({ organizationId: organization.id, actor: await loadActor(caller), via: caller.label, actionId, isDone });
        return { actionId: action.id, isDone: action.isDone, closedAt: action.closedAt };
      }),
  );

  server.registerTool(
    "workspace_update_people",
    {
      description: "Põe e tira responsáveis e põe participantes no card. Quem entra recebe aviso de tarefa nova: confirme com o usuário antes.",
      inputSchema: {
        actionId: z.string(),
        addResponsibleIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional(),
        removeResponsibleIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional(),
        addParticipantIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional(),
      },
    },
    ({ actionId, addResponsibleIds = [], removeResponsibleIds = [], addParticipantIds = [] }) =>
      runWorkspaceTool(caller, async () => {
        const { organization } = await loadAction(caller, actionId, { forEdit: true });
        await assertOrganizationMembers(organization, [...addResponsibleIds, ...addParticipantIds]);
        const actor = await loadActor(caller);
        for (const userId of new Set(addResponsibleIds)) {
          await addActionResponsible({ organizationId: organization.id, actor, actionId, userId });
        }
        for (const userId of new Set(addParticipantIds)) {
          await addActionParticipant({ organizationId: organization.id, actor, actionId, userId });
        }
        const currentResponsibleIds = new Set(
          (await prisma.actionsUserResponsible.findMany({ where: { actionId }, select: { userId: true } })).map((responsible) => responsible.userId),
        );
        // Tirar quem não estava é ignorado (CB-4).
        for (const userId of new Set(removeResponsibleIds)) {
          if (currentResponsibleIds.has(userId)) await removeActionResponsible({ organizationId: organization.id, actionId, userId });
        }
        const action = await prisma.action.findUniqueOrThrow({
          where: { id: actionId },
          select: { responsibles: { select: { user: userSummary } }, participants: { select: { user: userSummary } } },
        });
        return {
          actionId,
          responsibles: action.responsibles.map((responsible) => responsible.user),
          participants: action.participants.map((participant) => participant.user),
        };
      }),
  );

  server.registerTool(
    "workspace_update_tags",
    {
      description: "Põe e tira etiquetas do card. Só as etiquetas do workspace do card (veja em workspace_list_workspaces). Pôr etiqueta dispara as automações de \"card etiquetado\".",
      inputSchema: {
        actionId: z.string(),
        addTagIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional(),
        removeTagIds: z.array(z.string()).max(PEOPLE_PER_CALL).optional(),
      },
    },
    ({ actionId, addTagIds = [], removeTagIds = [] }) =>
      runWorkspaceTool(caller, async () => {
        const { organization, workspaceId } = await loadAction(caller, actionId, { forEdit: true });
        const workspaceTagIds = new Set(
          (await prisma.workspaceTag.findMany({ where: { workspaceId }, select: { id: true } })).map((tag) => tag.id),
        );
        const foreignTagIds = addTagIds.filter((tagId) => !workspaceTagIds.has(tagId));
        if (foreignTagIds.length > 0) throw new Error(`Etiqueta não encontrada neste workspace: ${foreignTagIds.join(", ")}.`);

        const currentTagIds = new Set((await prisma.actionTag.findMany({ where: { actionId }, select: { tagId: true } })).map((actionTag) => actionTag.tagId));
        for (const tagId of new Set(addTagIds)) {
          if (!currentTagIds.has(tagId)) await addActionTag({ organizationId: organization.id, actionId, tagId });
        }
        for (const tagId of new Set(removeTagIds)) {
          if (currentTagIds.has(tagId)) await removeActionTag({ organizationId: organization.id, actionId, tagId });
        }
        const tags = await prisma.actionTag.findMany({ where: { actionId }, select: { tag: { select: { id: true, name: true } } } });
        return { actionId, tags: tags.map((actionTag) => actionTag.tag) };
      }),
  );

  server.registerTool(
    "workspace_add_checklist_item",
    {
      description: "Adiciona um item no fim do checklist do card.",
      inputSchema: {
        actionId: z.string(),
        title: z.string().trim().min(1).max(300),
        finishDate: dateField("Data do item").optional(),
      },
    },
    ({ actionId, title, finishDate }) =>
      runWorkspaceTool(caller, async () => {
        const { organization } = await loadAction(caller, actionId, { forEdit: true });
        const item = await addActionChecklistItem({
          organizationId: organization.id,
          actor: await loadActor(caller),
          via: caller.label,
          actionId,
          title,
          finishDate: finishDate ? parseDate(finishDate, "finishDate") : undefined,
        });
        return { actionId, itemId: item.id, title: item.title, finishDate: item.finishDate };
      }),
  );
}
