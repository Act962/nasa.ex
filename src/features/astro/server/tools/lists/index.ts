import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type {
  AstroTablePayload,
  AstroTableRow,
} from "@/features/astro/lib/astro-table";

/**
 * Tools de LISTAGEM — retornam payloads de tabela renderizáveis pelo
 * Astro (kind="astro_table"). Cada linha vira link clicável pra rota
 * canônica da entidade no <AstroDataTable> do cliente.
 *
 * Diferente das tools de aggregate em `tools/analytics/`, aqui o
 * objetivo é "mostra os X" — não "quanto / qual a média". Quando o
 * user pede "lista as ações atrasadas", "mostra os leads ativos",
 * "quais propostas estão abertas" — chama uma destas.
 *
 * Convenção:
 * - Limite default 20 (ou 50 com `limit` explícito).
 * - Filtros padrão: orgIds, fromIso, toIso + filtros específicos.
 * - Permissão: target orgs = interseção das orgs do user.
 */
export function buildListTools(ctx: AgentContext) {
  return {
    // ── LEADS ─────────────────────────────────────────────────────────────
    list_leads: tool({
      description:
        "Lista leads com filtros + retorna tabela clicável (cada linha abre /contatos/{leadId}). Use quando o user pedir 'mostra os leads', 'lista os leads ativos', 'quais leads do tracking X', etc. NÃO use pra perguntas de contagem (use get_tracking_overview).",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
        statusIds: z.array(z.string()).optional(),
        tagIds: z.array(z.string()).optional(),
        responsibleIds: z.array(z.string()).optional(),
        currentAction: z
          .enum(["ACTIVE", "WON", "LOST"])
          .optional()
          .describe("Filtra por estado do lead no funil"),
        search: z.string().optional().describe("Busca em name/email/phone"),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        trackingIds,
        statusIds,
        tagIds,
        responsibleIds,
        currentAction,
        search,
        limit,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        // Trackings das orgs alvo (filtro)
        const trackings = await prisma.tracking.findMany({
          where: {
            organizationId: { in: targetOrgs },
            ...(trackingIds && trackingIds.length > 0
              ? { id: { in: trackingIds } }
              : {}),
          },
          select: { id: true },
        });
        const tIds = trackings.map((t) => t.id);
        if (tIds.length === 0) return emptyTable("lead", "Leads");

        const where = {
          trackingId: { in: tIds },
          ...(statusIds && statusIds.length > 0
            ? { statusId: { in: statusIds } }
            : {}),
          ...(responsibleIds && responsibleIds.length > 0
            ? { responsibleId: { in: responsibleIds } }
            : {}),
          ...(tagIds && tagIds.length > 0
            ? { leadTags: { some: { tagId: { in: tagIds } } } }
            : {}),
          ...(currentAction ? { currentAction } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        };

        const [leads, totalCount] = await Promise.all([
          prisma.lead.findMany({
            where,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              amount: true,
              currentAction: true,
              createdAt: true,
              status: { select: { name: true } },
              tracking: { select: { name: true } },
              responsible: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: limit ?? 20,
          }),
          prisma.lead.count({ where }),
        ]);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "lead",
          title: "Leads",
          caption: `${totalCount} lead(s) encontrado(s)`,
          totalCount,
          columns: [
            { key: "name", label: "Nome" },
            { key: "tracking", label: "Tracking" },
            { key: "status", label: "Status", type: "badge" },
            { key: "responsible", label: "Responsável" },
            { key: "amount", label: "Valor", type: "currency" },
            { key: "currentAction", label: "Estado", type: "badge" },
            { key: "createdAt", label: "Criado em", type: "date" },
          ],
          rows: leads.map((l) => ({
            id: l.id,
            name: l.name,
            tracking: l.tracking?.name ?? "—",
            status: l.status?.name ?? "—",
            responsible: l.responsible?.name ?? "—",
            // Lead.amount é Decimal de reais (não centavos) → multiplica
            // por 100 pra o renderer "currency" tratar como cents.
            amount: Math.round(Number(l.amount ?? 0) * 100),
            currentAction: l.currentAction,
            createdAt: l.createdAt.toISOString(),
          })),
        };
        return payload;
      },
    }),

    // ── ACTIONS (workspace tasks) ─────────────────────────────────────────
    list_actions: tool({
      description:
        "Lista actions (tarefas/eventos do workspace) com filtros + tabela clicável (cada linha abre /workspaces/{workspaceId}?actionId={id}, exatamente o card daquela action). Use quando o user pedir 'mostra as tarefas', 'liste minhas ações atrasadas', 'eventos do workspace X', etc.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        workspaceIds: z.array(z.string()).optional(),
        participantIds: z.array(z.string()).optional(),
        priorities: z
          .array(z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]))
          .optional(),
        isDone: z.boolean().optional(),
        overdue: z
          .boolean()
          .optional()
          .describe("Se true, só atrasadas (dueDate < now AND isDone=false)"),
        orgProjectIds: z.array(z.string()).optional(),
        tagIds: z.array(z.string()).optional(),
        leadIds: z.array(z.string()).optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        workspaceIds,
        participantIds,
        priorities,
        isDone,
        overdue,
        orgProjectIds,
        tagIds,
        leadIds,
        search,
        limit,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const now = new Date();
        const where = {
          organizationId: { in: targetOrgs },
          isArchived: false,
          ...(workspaceIds && workspaceIds.length > 0
            ? { workspaceId: { in: workspaceIds } }
            : {}),
          ...(priorities && priorities.length > 0
            ? { priority: { in: priorities } }
            : {}),
          ...(typeof isDone === "boolean" ? { isDone } : {}),
          ...(overdue
            ? { dueDate: { lt: now }, isDone: false }
            : {}),
          ...(orgProjectIds && orgProjectIds.length > 0
            ? { orgProjectId: { in: orgProjectIds } }
            : {}),
          ...(tagIds && tagIds.length > 0
            ? { tags: { some: { tagId: { in: tagIds } } } }
            : {}),
          ...(leadIds && leadIds.length > 0
            ? { leadId: { in: leadIds } }
            : {}),
          ...(participantIds && participantIds.length > 0
            ? {
                OR: [
                  {
                    responsibles: {
                      some: { userId: { in: participantIds } },
                    },
                  },
                  {
                    participants: {
                      some: { userId: { in: participantIds } },
                    },
                  },
                  { createdBy: { in: participantIds } },
                ],
              }
            : {}),
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" as const } },
                  {
                    description: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        };

        const [actions, totalCount] = await Promise.all([
          prisma.action.findMany({
            where,
            select: {
              id: true,
              title: true,
              priority: true,
              isDone: true,
              dueDate: true,
              workspaceId: true,
              workspace: { select: { name: true } },
              orgProject: { select: { name: true } },
              lead: { select: { name: true } },
              createdAt: true,
            },
            orderBy: [{ isDone: "asc" }, { dueDate: "asc" }],
            take: limit ?? 20,
          }),
          prisma.action.count({ where }),
        ]);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "action",
          title: "Ações / Tarefas",
          caption: `${totalCount} ação(ões) encontrada(s)`,
          totalCount,
          columns: [
            { key: "title", label: "Título" },
            { key: "workspace", label: "Workspace" },
            { key: "priority", label: "Prioridade", type: "badge" },
            { key: "statusLabel", label: "Status", type: "badge" },
            { key: "dueDate", label: "Vencimento", type: "date" },
            { key: "lead", label: "Lead" },
            { key: "project", label: "Projeto" },
          ],
          rows: actions.map((a) => ({
            id: a.id,
            workspaceId: a.workspaceId, // usado pela URL builder
            title: a.title,
            workspace: a.workspace?.name ?? "—",
            priority: a.priority,
            statusLabel: a.isDone
              ? "Concluída"
              : a.dueDate && a.dueDate < now
                ? "Atrasada"
                : "Aberta",
            dueDate: a.dueDate?.toISOString() ?? null,
            lead: a.lead?.name ?? "—",
            project: a.orgProject?.name ?? "—",
          })),
        };
        return payload;
      },
    }),

    // ── APPOINTMENTS (agenda) ─────────────────────────────────────────────
    list_appointments: tool({
      description:
        "Lista agendamentos (Spacetime) com filtros + tabela clicável (cada linha abre /agendas/{agendaId} onde o appointment está). Use quando o user pedir 'meus compromissos de hoje', 'reuniões da semana', 'agendamentos pendentes'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        agendaIds: z.array(z.string()).optional(),
        participantIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
        statuses: z
          .array(
            z.enum([
              "PENDING",
              "CONFIRMED",
              "DONE",
              "CANCELLED",
              "NO_SHOW",
            ]),
          )
          .optional(),
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        agendaIds,
        participantIds,
        trackingIds,
        statuses,
        fromIso,
        toIso,
        limit,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const where = {
          agenda: {
            organizationId: { in: targetOrgs },
            ...(agendaIds && agendaIds.length > 0
              ? { id: { in: agendaIds } }
              : {}),
          },
          ...(participantIds && participantIds.length > 0
            ? { userId: { in: participantIds } }
            : {}),
          ...(trackingIds && trackingIds.length > 0
            ? { trackingId: { in: trackingIds } }
            : {}),
          ...(statuses && statuses.length > 0
            ? { status: { in: statuses } }
            : {}),
          ...(fromIso || toIso
            ? {
                startsAt: {
                  ...(fromIso ? { gte: new Date(fromIso) } : {}),
                  ...(toIso ? { lte: new Date(toIso) } : {}),
                },
              }
            : {}),
        };

        const [appts, totalCount] = await Promise.all([
          prisma.appointment.findMany({
            where,
            select: {
              id: true,
              title: true,
              startsAt: true,
              status: true,
              agendaId: true,
              agenda: { select: { name: true } },
              lead: { select: { name: true } },
              user: { select: { name: true } },
            },
            orderBy: { startsAt: "asc" },
            take: limit ?? 20,
          }),
          prisma.appointment.count({ where }),
        ]);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "appointment",
          title: "Agendamentos",
          caption: `${totalCount} agendamento(s)`,
          totalCount,
          columns: [
            { key: "title", label: "Título" },
            { key: "agenda", label: "Agenda" },
            { key: "startsAt", label: "Início", type: "date" },
            { key: "status", label: "Status", type: "badge" },
            { key: "lead", label: "Lead" },
            { key: "responsible", label: "Responsável" },
          ],
          rows: appts.map((a) => ({
            id: a.id,
            agendaId: a.agendaId,
            title: a.title ?? "(sem título)",
            agenda: a.agenda?.name ?? "—",
            startsAt: a.startsAt.toISOString(),
            status: a.status,
            lead: a.lead?.name ?? "—",
            responsible: a.user?.name ?? "—",
          })),
        };
        return payload;
      },
    }),

    // ── PROPOSALS (Forge) ─────────────────────────────────────────────────
    list_proposals: tool({
      description:
        "Lista propostas Forge com filtros + tabela clicável (abre /forge — sem deep-link interno ainda). Use quando o user pedir 'mostra as propostas', 'liste propostas pagas', 'propostas abertas'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        statuses: z
          .array(
            z.enum([
              "RASCUNHO",
              "ENVIADA",
              "VISUALIZADA",
              "PAGA",
              "EXPIRADA",
              "CANCELADA",
            ]),
          )
          .optional(),
        responsibleIds: z.array(z.string()).optional(),
        leadIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        statuses,
        responsibleIds,
        leadIds,
        limit,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const where = {
          organizationId: { in: targetOrgs },
          ...(statuses && statuses.length > 0
            ? { status: { in: statuses } }
            : {}),
          ...(responsibleIds && responsibleIds.length > 0
            ? { responsibleId: { in: responsibleIds } }
            : {}),
          ...(leadIds && leadIds.length > 0
            ? { clientId: { in: leadIds } }
            : {}),
        };

        const [props, totalCount] = await Promise.all([
          prisma.forgeProposal.findMany({
            where,
            select: {
              id: true,
              title: true,
              status: true,
              discount: true,
              discountType: true,
              createdAt: true,
              updatedAt: true,
              client: { select: { name: true } },
              responsible: { select: { name: true } },
              products: { select: { quantity: true, unitValue: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: limit ?? 20,
          }),
          prisma.forgeProposal.count({ where }),
        ]);

        const calcValue = (p: {
          discount: { toString(): string } | null;
          discountType: "PERCENTUAL" | "FIXO" | null;
          products: {
            quantity: { toString(): string };
            unitValue: { toString(): string };
          }[];
        }) => {
          const subtotal = p.products.reduce(
            (s, x) => s + Number(x.quantity) * Number(x.unitValue),
            0,
          );
          if (!p.discount) return subtotal;
          const disc = Number(p.discount);
          if (p.discountType === "PERCENTUAL")
            return subtotal * (1 - disc / 100);
          return Math.max(0, subtotal - disc);
        };

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "proposal",
          title: "Propostas",
          caption: `${totalCount} proposta(s)`,
          totalCount,
          columns: [
            { key: "title", label: "Título" },
            { key: "status", label: "Status", type: "badge" },
            { key: "client", label: "Cliente" },
            { key: "responsible", label: "Responsável" },
            { key: "value", label: "Valor", type: "currency" },
            { key: "updatedAt", label: "Atualizado", type: "date" },
          ],
          rows: props.map((p) => ({
            id: p.id,
            title: p.title ?? "(sem título)",
            status: p.status,
            client: p.client?.name ?? "—",
            responsible: p.responsible?.name ?? "—",
            value: Math.round(calcValue(p) * 100),
            updatedAt: p.updatedAt.toISOString(),
          })),
        };
        return payload;
      },
    }),

    // ── CONVERSATIONS (chat) ──────────────────────────────────────────────
    list_conversations: tool({
      description:
        "Lista conversas de chat com filtros + tabela clicável (abre /tracking/{trackingId}/chat/{conversationId}). Use quando o user pedir 'mostra as conversas', 'conversas ativas', 'chats sem resposta'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        responsibleIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        trackingIds,
        isActive,
        responsibleIds,
        limit,
      }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const trackings = await prisma.tracking.findMany({
          where: {
            organizationId: { in: targetOrgs },
            ...(trackingIds && trackingIds.length > 0
              ? { id: { in: trackingIds } }
              : {}),
          },
          select: { id: true },
        });
        const tIds = trackings.map((t) => t.id);
        if (tIds.length === 0)
          return emptyTable("conversation", "Conversas");

        const where = {
          trackingId: { in: tIds },
          ...(typeof isActive === "boolean" ? { isActive } : {}),
          ...(responsibleIds && responsibleIds.length > 0
            ? { lead: { responsibleId: { in: responsibleIds } } }
            : {}),
        };

        const [convs, totalCount] = await Promise.all([
          prisma.conversation.findMany({
            where,
            select: {
              id: true,
              name: true,
              lastMessageAt: true,
              trackingId: true,
              tracking: { select: { name: true } },
              lead: {
                select: {
                  name: true,
                  responsible: { select: { name: true } },
                },
              },
            },
            orderBy: { lastMessageAt: "desc" },
            take: limit ?? 20,
          }),
          prisma.conversation.count({ where }),
        ]);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "conversation",
          title: "Conversas",
          caption: `${totalCount} conversa(s)`,
          totalCount,
          columns: [
            { key: "name", label: "Contato" },
            { key: "tracking", label: "Tracking" },
            { key: "responsible", label: "Responsável" },
            { key: "lastMessageAt", label: "Última msg", type: "date" },
          ],
          rows: convs.map((c) => ({
            id: c.id,
            trackingId: c.trackingId,
            name: c.lead?.name ?? c.name ?? "(sem nome)",
            tracking: c.tracking?.name ?? "—",
            responsible: c.lead?.responsible?.name ?? "—",
            lastMessageAt: c.lastMessageAt.toISOString(),
          })),
        };
        return payload;
      },
    }),

    // ── TRACKINGS ─────────────────────────────────────────────────────────
    list_trackings: tool({
      description:
        "Lista trackings (pipelines) da empresa + tabela clicável (abre /tracking/{id}). Use quando o user pedir 'quais meus trackings', 'mostra os pipelines'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ orgIds, limit }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const trackings = await prisma.tracking.findMany({
          where: { organizationId: { in: targetOrgs } },
          select: {
            id: true,
            name: true,
            organizationId: true,
            createdAt: true,
            _count: { select: { leads: true, status: true } },
          },
          orderBy: { name: "asc" },
          take: limit ?? 20,
        });

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "tracking",
          title: "Trackings",
          caption: `${trackings.length} tracking(s)`,
          totalCount: trackings.length,
          columns: [
            { key: "name", label: "Nome" },
            { key: "leadCount", label: "Leads", type: "number" },
            { key: "statusCount", label: "Etapas", type: "number" },
            { key: "createdAt", label: "Criado em", type: "date" },
          ],
          rows: trackings.map((t) => ({
            id: t.id,
            name: t.name,
            leadCount: t._count.leads,
            statusCount: t._count.status,
            createdAt: t.createdAt.toISOString(),
          })),
        };
        return payload;
      },
    }),

    // ── AGENDAS ───────────────────────────────────────────────────────────
    list_agendas: tool({
      description:
        "Lista agendas (Spacetime) + tabela clicável (abre /agendas/{id}). Use quando o user pedir 'minhas agendas', 'lista as agendas'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ orgIds, limit }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        const targetOrgs =
          orgIds && orgIds.length > 0
            ? orgIds.filter((id) => myOrgIds.includes(id))
            : myOrgIds;
        if (targetOrgs.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const agendas = await prisma.agenda.findMany({
          where: { organizationId: { in: targetOrgs } },
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: { select: { appointments: true } },
          },
          orderBy: { name: "asc" },
          take: limit ?? 20,
        });

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "agenda",
          title: "Agendas",
          caption: `${agendas.length} agenda(s)`,
          totalCount: agendas.length,
          columns: [
            { key: "title", label: "Título" },
            { key: "appointmentCount", label: "Agendamentos", type: "number" },
            { key: "createdAt", label: "Criada em", type: "date" },
          ],
          rows: agendas.map((a) => ({
            id: a.id,
            title: a.name,
            appointmentCount: a._count.appointments,
            createdAt: a.createdAt.toISOString(),
          })),
        };
        return payload;
      },
    }),
  };
}

function emptyTable(
  entityType: AstroTablePayload["entityType"],
  title: string,
): AstroTablePayload {
  return {
    kind: "astro_table",
    entityType,
    title,
    caption: "Nenhum resultado encontrado",
    totalCount: 0,
    columns: [],
    rows: [],
  };
}
