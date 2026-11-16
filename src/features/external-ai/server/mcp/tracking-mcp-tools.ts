import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/utils/format-phone";
import { moveLeadToStage } from "@/features/leads/lib/move-lead";
import {
  addLeadNoteRecord,
  addLeadTagsRecord,
  createLeadRecord,
  removeLeadTagsRecord,
  updateLeadRecord,
  type LeadActor,
} from "@/features/leads/server/lead-commands";
import { TRACKING_SCOPE, type ExternalAiCaller } from "../access-tokens";
import { createScopedToolRunner } from "./tool-runner";

// Tracking pelo MCP (spec 0145): a IA da pessoa lê e mexe nos leads dos funis em que ela participa, com os efeitos da tela.

const LEADS_LIMIT = 100;
const HISTORY_LIMIT = 30;
const TAGS_PER_CALL = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_LEAD = "Lead não encontrado.";
const NOT_FOUND_TRACKING = "Funil não encontrado, ou você não participa dele.";

const TEMPERATURES = ["COLD", "WARM", "HOT", "VERY_HOT"] as const;


/** O app aparece para quem participa de algum funil não arquivado. */
export async function hasAnyTrackingParticipation(userId: string): Promise<boolean> {
  const participation = await prisma.trackingParticipant.findFirst({ where: { userId, tracking: { isArchived: false } }, select: { id: true } });
  return participation !== null;
}

const keyOrganizationFilter = (caller: ExternalAiCaller): Prisma.TrackingWhereInput =>
  caller.credential === "key" ? { organizationId: { in: caller.organizationIds } } : {};

/** Funil em que a pessoa participa, dentro de uma empresa permitida (RF-2). */
async function loadTracking(caller: ExternalAiCaller, trackingId: string, options: { forEdit: boolean }) {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, isArchived: false, ...keyOrganizationFilter(caller), participants: { some: { userId: caller.userId } } },
    select: { id: true, name: true, organizationId: true, participants: { where: { userId: caller.userId }, select: { role: true } } },
  });
  if (!tracking) throw new Error(NOT_FOUND_TRACKING);
  if (options.forEdit && tracking.participants[0]?.role === "VIEWER") {
    throw new Error(`Você só pode ver o funil "${tracking.name}", não mudar leads nele.`);
  }
  return tracking;
}

async function loadLead(caller: ExternalAiCaller, leadId: string, options: { forEdit: boolean }) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId }, select: { id: true, trackingId: true, statusId: true } });
  if (!lead) throw new Error(NOT_FOUND_LEAD);
  try {
    const tracking = await loadTracking(caller, lead.trackingId, options);
    return { lead, tracking };
  } catch (error) {
    if (error instanceof Error && error.message === NOT_FOUND_TRACKING) throw new Error(NOT_FOUND_LEAD);
    throw error;
  }
}

async function assertParticipants(trackingId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const participants = await prisma.trackingParticipant.findMany({ where: { trackingId, userId: { in: userIds } }, select: { userId: true } });
  const participantIds = new Set(participants.map((participant) => participant.userId));
  const outsiders = userIds.filter((userId) => !participantIds.has(userId));
  if (outsiders.length > 0) throw new Error(`Estas pessoas não participam do funil: ${outsiders.join(", ")}. Use os ids de tracking_list_trackings.`);
}

/** Etiquetas que o funil enxerga: as da empresa sem funil e as do próprio funil, não arquivadas. */
const trackingTagsWhere = (tracking: { id: string; organizationId: string }): Prisma.TagWhereInput => ({
  organizationId: tracking.organizationId,
  archivedAt: null,
  OR: [{ trackingId: null }, { trackingId: tracking.id }],
});

async function loadActor(caller: ExternalAiCaller): Promise<LeadActor> {
  return prisma.user.findUniqueOrThrow({ where: { id: caller.userId }, select: { id: true, name: true, email: true, image: true } });
}

function toPhone(value: string): string {
  const phone = normalizeWhatsappPhoneBr(value);
  if (!phone) throw new Error("Telefone inválido: mande com DDD, ex.: (86) 99999-0000 ou 5586999990000.");
  return phone;
}

const toDay = (date: Date | null | undefined) => (date ? date.toISOString() : null);
const userSummary = { select: { id: true, name: true } } as const;

const runTrackingTool = createScopedToolRunner({ scope: TRACKING_SCOPE, appName: "ao Tracking", rateLimitKey: "mcp-tracking" });

export function registerTrackingMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "tracking_list_trackings",
    {
      description: "Empresas e funis (Tracking) de que você participa, com as colunas em ordem, as etiquetas e os participantes de cada um. Comece por aqui.",
      inputSchema: {},
    },
    () =>
      runTrackingTool(caller, async () => {
        const trackings = await prisma.tracking.findMany({
          where: { isArchived: false, ...keyOrganizationFilter(caller), participants: { some: { userId: caller.userId } } },
          select: {
            id: true,
            name: true,
            organization: { select: { id: true, name: true } },
            status: { select: { id: true, name: true }, orderBy: { order: "asc" } },
            participants: { select: { role: true, user: userSummary } },
          },
          orderBy: { name: "asc" },
        });
        const tags = await prisma.tag.findMany({
          where: {
            organizationId: { in: [...new Set(trackings.map((tracking) => tracking.organization.id))] },
            archivedAt: null,
            OR: [{ trackingId: null }, { trackingId: { in: trackings.map((tracking) => tracking.id) } }],
          },
          select: { id: true, name: true, organizationId: true, trackingId: true },
          orderBy: { name: "asc" },
        });
        return trackings.map((tracking) => ({
          trackingId: tracking.id,
          name: tracking.name,
          organization: tracking.organization,
          yourRole: tracking.participants.find((participant) => participant.user.id === caller.userId)?.role,
          columns: tracking.status.map((status) => ({ statusId: status.id, name: status.name })),
          tags: tags
            .filter((tag) => tag.organizationId === tracking.organization.id && (tag.trackingId === null || tag.trackingId === tracking.id))
            .map((tag) => ({ tagId: tag.id, name: tag.name })),
          participants: tracking.participants.map((participant) => ({ ...participant.user, role: participant.role })),
        }));
      }),
  );

  server.registerTool(
    "tracking_list_leads",
    {
      description: `Leads de um funil, com filtros, até ${LEADS_LIMIT}. Por padrão só os em andamento (não ganhos, perdidos nem arquivados), os parados há mais tempo primeiro.`,
      inputSchema: {
        trackingId: z.string(),
        statusId: z.string().optional().describe("Só esta coluna"),
        search: z.string().max(200).optional().describe("Nome, telefone ou e-mail"),
        tagIds: z.array(z.string()).max(TAGS_PER_CALL).optional().describe("Leads com qualquer uma destas etiquetas"),
        responsibleId: z.string().optional(),
        temperature: z.enum(TEMPERATURES).optional(),
        staleDays: z.number().int().min(1).max(3650).optional().describe("Só leads que entraram na coluna atual há mais de N dias"),
        includeClosed: z.boolean().optional().describe("Incluir ganhos e perdidos"),
        limit: z.number().int().min(1).max(LEADS_LIMIT).optional(),
      },
    },
    (input) =>
      runTrackingTool(caller, async () => {
        const tracking = await loadTracking(caller, input.trackingId, { forEdit: false });
        const digits = input.search?.replace(/\D/g, "");
        const staleBefore = input.staleDays ? new Date(Date.now() - input.staleDays * DAY_MS) : null;
        const where: Prisma.LeadWhereInput = {
          trackingId: tracking.id,
          isArchived: false,
          ...(input.includeClosed ? { currentAction: { not: "DELETED" } } : { currentAction: "ACTIVE" }),
          ...(input.statusId ? { statusId: input.statusId } : {}),
          ...(input.responsibleId ? { responsibleId: input.responsibleId } : {}),
          ...(input.temperature ? { temperature: input.temperature } : {}),
          ...(input.tagIds?.length ? { leadTags: { some: { tagId: { in: input.tagIds } } } } : {}),
          AND: [
            ...(input.search
              ? [
                  {
                    OR: [
                      { name: { contains: input.search, mode: "insensitive" as const } },
                      { email: { contains: input.search, mode: "insensitive" as const } },
                      ...(digits ? [{ phone: { contains: digits } }] : []),
                    ],
                  },
                ]
              : []),
            // Lead antigo sem `statusEnteredAt` conta pela data de criação (CB-4).
            ...(staleBefore
              ? [{ OR: [{ statusEnteredAt: { lt: staleBefore } }, { statusEnteredAt: null, createdAt: { lt: staleBefore } }] }]
              : []),
          ],
        };
        const [total, leads] = await Promise.all([
          prisma.lead.count({ where }),
          prisma.lead.findMany({
            where,
            orderBy: [{ statusEnteredAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
            take: input.limit ?? 30,
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              amount: true,
              temperature: true,
              currentAction: true,
              statusEnteredAt: true,
              createdAt: true,
              status: { select: { id: true, name: true } },
              responsible: userSummary,
              leadTags: { select: { tag: { select: { id: true, name: true } } } },
            },
          }),
        ]);
        const now = Date.now();
        return {
          total,
          leads: leads.map((lead) => {
            const enteredAt = lead.statusEnteredAt ?? lead.createdAt;
            return {
              leadId: lead.id,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              amount: Number(lead.amount),
              temperature: lead.temperature,
              situation: lead.currentAction,
              column: lead.status,
              daysInColumn: Math.floor((now - enteredAt.getTime()) / DAY_MS),
              responsible: lead.responsible,
              tags: lead.leadTags.map((leadTag) => leadTag.tag),
            };
          }),
        };
      }),
  );

  server.registerTool(
    "tracking_get_lead",
    {
      description: `A ficha do lead: contato, valor, temperatura, coluna, responsável, etiquetas e as últimas ${HISTORY_LIMIT} entradas do histórico.`,
      inputSchema: { leadId: z.string() },
    },
    ({ leadId }) =>
      runTrackingTool(caller, async () => {
        await loadLead(caller, leadId, { forEdit: false });
        const lead = await prisma.lead.findUniqueOrThrow({
          where: { id: leadId },
          select: {
            id: true,
            name: true,
            nickname: true,
            phone: true,
            email: true,
            document: true,
            description: true,
            amount: true,
            temperature: true,
            currentAction: true,
            source: true,
            statusEnteredAt: true,
            createdAt: true,
            tracking: { select: { id: true, name: true } },
            status: { select: { id: true, name: true } },
            responsible: userSummary,
            leadTags: { select: { tag: { select: { id: true, name: true } } } },
            history: {
              orderBy: { createdAt: "desc" },
              take: HISTORY_LIMIT,
              select: { createdAt: true, action: true, eventType: true, notes: true, user: userSummary },
            },
          },
        });
        return {
          leadId: lead.id,
          name: lead.name,
          nickname: lead.nickname,
          phone: lead.phone,
          email: lead.email,
          document: lead.document,
          description: lead.description,
          amount: Number(lead.amount),
          temperature: lead.temperature,
          situation: lead.currentAction,
          source: lead.source,
          tracking: lead.tracking,
          column: lead.status,
          inColumnSince: toDay(lead.statusEnteredAt ?? lead.createdAt),
          createdAt: toDay(lead.createdAt),
          responsible: lead.responsible,
          tags: lead.leadTags.map((leadTag) => leadTag.tag),
          history: lead.history.map((entry) => ({ at: toDay(entry.createdAt), type: entry.eventType ?? entry.action, notes: entry.notes, by: entry.user })),
          openPath: `/tracking/${lead.tracking.id}`,
        };
      }),
  );

  server.registerTool(
    "tracking_create_lead",
    {
      description:
        "Cria um lead no funil, com você de responsável. Sem coluna, entra na primeira. Se o telefone já existe no funil, devolve o lead que já existe (alreadyExisted: true) e não cria outro.",
      inputSchema: {
        trackingId: z.string(),
        name: z.string().trim().min(1).max(200),
        phone: z.string().min(8).max(30).describe("Com DDD, ex.: (86) 99999-0000"),
        statusId: z.string().optional(),
        email: z.string().email().max(200).optional(),
        description: z.string().max(5000).optional(),
      },
    },
    (input) =>
      runTrackingTool(caller, async () => {
        const tracking = await loadTracking(caller, input.trackingId, { forEdit: true });
        const status = await prisma.status.findFirst({
          where: { trackingId: tracking.id, ...(input.statusId ? { id: input.statusId } : {}) },
          orderBy: { order: "asc" },
          select: { id: true, name: true },
        });
        if (!status) throw new Error(input.statusId ? "Coluna não encontrada neste funil." : "Este funil não tem coluna.");
        const { lead, isNewLead } = await createLeadRecord({
          actor: await loadActor(caller),
          via: caller.label,
          input: { name: input.name, phone: toPhone(input.phone), email: input.email, description: input.description, statusId: status.id, trackingId: tracking.id },
        });
        const column = isNewLead ? status : await prisma.status.findUnique({ where: { id: lead.statusId }, select: { id: true, name: true } });
        return { leadId: lead.id, name: lead.name, phone: lead.phone, alreadyExisted: !isNewLead, column, openPath: `/tracking/${tracking.id}` };
      }),
  );

  server.registerTool(
    "tracking_update_lead",
    {
      description: "Muda nome, e-mail, descrição, valor (em reais), temperatura ou responsável do lead. Mande só o que muda. Para coluna use tracking_move_lead.",
      inputSchema: {
        leadId: z.string(),
        name: z.string().trim().min(1).max(200).optional(),
        email: z.string().email().max(200).optional(),
        description: z.string().max(5000).optional(),
        amount: z.number().min(0).max(1_000_000_000).optional().describe("Valor em reais, ex.: 1500.50"),
        temperature: z.enum(TEMPERATURES).optional(),
        responsibleId: z.string().optional().describe("Precisa participar do funil"),
      },
    },
    ({ leadId, ...fields }) =>
      runTrackingTool(caller, async () => {
        const { tracking } = await loadLead(caller, leadId, { forEdit: true });
        if (Object.values(fields).every((value) => value === undefined)) throw new Error("Nada para mudar: mande ao menos um campo.");
        if (fields.responsibleId) await assertParticipants(tracking.id, [fields.responsibleId]);
        const { lead } = await updateLeadRecord({ actor: await loadActor(caller), via: caller.label, input: { id: leadId, ...fields } });
        return { leadId: lead.id, name: lead.name, email: lead.email, responsibleId: lead.responsibleId };
      }),
  );

  server.registerTool(
    "tracking_move_lead",
    {
      description:
        "Move o lead para outra coluna do mesmo funil. Pode disparar Gatilhos Automáticos da coluna, e alguns mandam mensagem ao cliente: confirme com o usuário antes.",
      inputSchema: { leadId: z.string(), statusId: z.string() },
    },
    ({ leadId, statusId }) =>
      runTrackingTool(caller, async () => {
        const { lead, tracking } = await loadLead(caller, leadId, { forEdit: true });
        const status = await prisma.status.findFirst({ where: { id: statusId, trackingId: tracking.id }, select: { id: true, name: true } });
        if (!status) throw new Error("Coluna não encontrada neste funil.");
        const actor = await loadActor(caller);
        const moved = await moveLeadToStage({ leadId: lead.id, toTrackingId: tracking.id, toStatusId: status.id, actor: { ...actor, via: caller.label } });
        return { leadId: moved.leadId, column: status, changed: moved.hasStatusChanged };
      }),
  );

  server.registerTool(
    "tracking_update_tags",
    {
      description: "Põe e tira etiquetas do lead (as do funil, de tracking_list_trackings). Pôr etiqueta pode disparar Gatilhos Automáticos: confirme com o usuário antes.",
      inputSchema: {
        leadId: z.string(),
        addTagIds: z.array(z.string()).max(TAGS_PER_CALL).optional(),
        removeTagIds: z.array(z.string()).max(TAGS_PER_CALL).optional(),
      },
    },
    ({ leadId, addTagIds = [], removeTagIds = [] }) =>
      runTrackingTool(caller, async () => {
        const { tracking } = await loadLead(caller, leadId, { forEdit: true });
        const requestedIds = [...new Set([...addTagIds, ...removeTagIds])];
        const allowedIds = new Set(
          (await prisma.tag.findMany({ where: { id: { in: requestedIds }, ...trackingTagsWhere(tracking) }, select: { id: true } })).map((tag) => tag.id),
        );
        const unknownIds = requestedIds.filter((tagId) => !allowedIds.has(tagId));
        if (unknownIds.length > 0) throw new Error(`Etiqueta não encontrada neste funil: ${unknownIds.join(", ")}.`);

        const currentIds = new Set((await prisma.leadTag.findMany({ where: { leadId }, select: { tagId: true } })).map((leadTag) => leadTag.tagId));
        const toAdd = [...new Set(addTagIds)].filter((tagId) => !currentIds.has(tagId));
        const toRemove = [...new Set(removeTagIds)].filter((tagId) => currentIds.has(tagId));
        const actor = await loadActor(caller);
        if (toAdd.length > 0) await addLeadTagsRecord({ actor, via: caller.label, leadId, tagIds: toAdd });
        if (toRemove.length > 0) await removeLeadTagsRecord({ actor, via: caller.label, leadId, tagIds: toRemove });
        const tags = await prisma.leadTag.findMany({ where: { leadId }, select: { tag: { select: { id: true, name: true } } } });
        return { leadId, tags: tags.map((leadTag) => leadTag.tag) };
      }),
  );

  server.registerTool(
    "tracking_add_note",
    {
      description: "Anota no histórico do lead (aparece na jornada dele na tela). Não muda coluna nem situação.",
      inputSchema: { leadId: z.string(), notes: z.string().trim().min(1).max(5000) },
    },
    ({ leadId, notes }) =>
      runTrackingTool(caller, async () => {
        await loadLead(caller, leadId, { forEdit: true });
        const entry = await addLeadNoteRecord({ actor: await loadActor(caller), via: caller.label, leadId, notes });
        return { leadId, noteId: entry.id, at: toDay(entry.createdAt) };
      }),
  );
}
