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
            // Contato fica nas linhas (não nas colunas): a UI in-app só renderiza
            // as `columns`, mas o modelo/WhatsApp leem o row pra responder
            // "nome e contato". `phone`/`email` também alimentam a URL de detalhe.
            phone: l.phone ?? "",
            email: l.email ?? "",
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
        ids: z
          .array(z.string())
          .optional()
          .describe("Filtra actions pelos IDs específicos."),
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
        ids,
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
          ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
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
        "Lista agendamentos (Spacetime) com filtros + tabela clicável (cada linha abre /agendas/{agendaId} onde o appointment está). Use quando o user pedir 'meus compromissos de hoje', 'reuniões da semana', 'agendamentos pendentes'. Use `ids` ou `search` pra mostrar um appointment específico (ex: após criar).",
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
        ids: z
          .array(z.string())
          .optional()
          .describe("Filtra appointments pelos IDs específicos."),
        search: z
          .string()
          .optional()
          .describe("Busca no título do appointment."),
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
        ids,
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
          ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
          ...(search
            ? { title: { contains: search, mode: "insensitive" as const } }
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
        ids: z
          .array(z.string())
          .optional()
          .describe("Filtra propostas pelos IDs específicos."),
        search: z
          .string()
          .optional()
          .describe("Busca no título da proposta."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        statuses,
        responsibleIds,
        leadIds,
        ids,
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
          ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
          ...(search
            ? { title: { contains: search, mode: "insensitive" as const } }
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

    // ── PAYMENT ENTRIES (lançamentos financeiros) ────────────────────────
    list_payment_entries: tool({
      description:
        "Lista lançamentos financeiros (despesas/receitas) com filtros + tabela. Filtros: tipo (RECEIVABLE/PAYABLE), status (PENDING/PAID/OVERDUE/etc), categoria, fornecedor (contact), conta bancária, período, valor min/max, parcelas. Use pra 'lista despesas', 'minhas receitas do mês', 'pagamentos pendentes acima de R$ 500', etc.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        type: z
          .enum(["RECEIVABLE", "PAYABLE"])
          .optional()
          .describe("RECEIVABLE = receita, PAYABLE = despesa. Sem isso, mostra ambos."),
        statuses: z
          .array(z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]))
          .optional(),
        categoryIds: z.array(z.string()).optional(),
        contactIds: z
          .array(z.string())
          .optional()
          .describe("IDs de fornecedores/clientes (PaymentContact)."),
        accountIds: z
          .array(z.string())
          .optional()
          .describe("IDs de contas bancárias (PaymentBankAccount)."),
        fromIso: z
          .string()
          .optional()
          .describe("Filtra por dueDate ≥ fromIso (vencimento)."),
        toIso: z
          .string()
          .optional()
          .describe("Filtra por dueDate ≤ toIso."),
        amountMinCents: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Valor mínimo EM CENTAVOS (ex: 'acima de R$ 500' → 50000).",
          ),
        amountMaxCents: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Valor máximo em centavos (ex: 'abaixo de R$ 100' → 10000)."),
        installmentTotal: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Filtra por total de parcelas (1 = à vista, 2+ = parcelado).",
          ),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        type,
        statuses,
        categoryIds,
        contactIds,
        accountIds,
        fromIso,
        toIso,
        amountMinCents,
        amountMaxCents,
        installmentTotal,
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
          ...(type ? { type } : {}),
          ...(statuses && statuses.length > 0
            ? { status: { in: statuses } }
            : {}),
          ...(categoryIds && categoryIds.length > 0
            ? { categoryId: { in: categoryIds } }
            : {}),
          ...(contactIds && contactIds.length > 0
            ? { contactId: { in: contactIds } }
            : {}),
          ...(accountIds && accountIds.length > 0
            ? { accountId: { in: accountIds } }
            : {}),
          ...(typeof installmentTotal === "number"
            ? { installmentTotal }
            : {}),
          ...(fromIso || toIso
            ? {
                dueDate: {
                  ...(fromIso ? { gte: new Date(fromIso) } : {}),
                  ...(toIso ? { lte: new Date(toIso) } : {}),
                },
              }
            : {}),
          ...(typeof amountMinCents === "number" ||
          typeof amountMaxCents === "number"
            ? {
                amount: {
                  ...(typeof amountMinCents === "number"
                    ? { gte: amountMinCents }
                    : {}),
                  ...(typeof amountMaxCents === "number"
                    ? { lte: amountMaxCents }
                    : {}),
                },
              }
            : {}),
        };

        const [entries, totalCount] = await Promise.all([
          prisma.paymentEntry.findMany({
            where,
            select: {
              id: true,
              type: true,
              status: true,
              description: true,
              amount: true,
              dueDate: true,
              installmentCurrent: true,
              installmentTotal: true,
              documentNumber: true,
              category: { select: { name: true } },
              contact: { select: { name: true } },
              account: { select: { name: true } },
            },
            orderBy: { dueDate: "desc" },
            take: limit ?? 20,
          }),
          prisma.paymentEntry.count({ where }),
        ]);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user", // PaymentEntry sem rota de detalhe direta — abre via /financeiro
          title: type === "PAYABLE"
            ? "Despesas"
            : type === "RECEIVABLE"
              ? "Receitas"
              : "Lançamentos financeiros",
          caption: `${totalCount} lançamento(s)`,
          totalCount,
          columns: [
            { key: "description", label: "Descrição" },
            { key: "typeLabel", label: "Tipo", type: "badge" },
            { key: "amount", label: "Valor", type: "currency" },
            { key: "status", label: "Status", type: "badge" },
            { key: "dueDate", label: "Vencimento", type: "date" },
            { key: "installments", label: "Parcelas" },
            { key: "category", label: "Categoria" },
            { key: "contact", label: "Fornecedor/Cliente" },
            { key: "account", label: "Conta" },
            { key: "documentNumber", label: "Documento" },
          ],
          rows: entries.map((e) => ({
            id: e.id,
            description: e.description,
            typeLabel: e.type === "PAYABLE" ? "Despesa" : "Receita",
            amount: e.amount, // já em centavos
            status: e.status,
            dueDate: e.dueDate.toISOString(),
            installments: `${e.installmentCurrent ?? 1}/${e.installmentTotal ?? 1}`,
            category: e.category?.name ?? "—",
            contact: e.contact?.name ?? "—",
            account: e.account?.name ?? "—",
            documentNumber: e.documentNumber ?? "—",
          })),
        };
        return payload;
      },
    }),

    // ── PAYMENT CATEGORIES (lista clicável) ──────────────────────────────
    list_payment_categories: tool({
      description:
        "Lista categorias financeiras disponíveis pra classificar PaymentEntries (despesas/receitas). Retorna TABELA. Use após create_payment_entry pra mostrar opções ao user, ou quando o user pedir 'minhas categorias financeiras'.",
      inputSchema: z.object({
        type: z
          .enum(["REVENUE", "EXPENSE", "COST"])
          .optional()
          .describe("Filtra por tipo. Sem isso, retorna todas."),
      }),
      execute: async ({ type }) => {
        const memberships = await prisma.member.findMany({
          where: { userId: ctx.userId },
          select: { organizationId: true },
        });
        const myOrgIds = memberships.map((m) => m.organizationId);
        if (myOrgIds.length === 0) {
          return { error: "Sem acesso a nenhuma organização" };
        }

        const categories = await prisma.paymentCategory.findMany({
          where: {
            organizationId: { in: myOrgIds },
            isActive: true,
            ...(type ? { type } : {}),
          },
          select: {
            id: true,
            name: true,
            color: true,
            type: true,
          },
          orderBy: [{ type: "asc" }, { name: "asc" }],
          take: 50,
        });

        const typeLabel: Record<string, string> = {
          REVENUE: "Receita",
          EXPENSE: "Despesa",
          COST: "Custo",
        };

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user", // entityType genérico não-clicável
          title: "Categorias financeiras",
          caption: `${categories.length} categoria(s)${type ? ` do tipo ${typeLabel[type] ?? type}` : ""}`,
          totalCount: categories.length,
          columns: [
            { key: "name", label: "Nome" },
            { key: "type", label: "Tipo", type: "badge" },
            { key: "color", label: "Cor" },
          ],
          rows: categories.map((c) => ({
            id: c.id,
            name: c.name,
            type: typeLabel[c.type] ?? c.type,
            color: c.color ?? "—",
          })),
        };
        return payload;
      },
    }),

    // ── APPOINTMENT CREATORS (ranking de colaboradores) ──────────────────
    // Tabela de quem mais criou agendamentos no período. Use quando o
    // user perguntar "lista dos colaboradores que criaram", "top
    // atendentes", "quem marcou mais reuniões". Não-clicável (user não
    // tem rota de detalhe).
    list_appointment_creators: tool({
      description:
        "Lista TOP COLABORADORES que criaram agendamentos no período + tabela com nome/email/total. Use sempre que o user pedir 'lista dos colaboradores que criaram', 'quem marcou mais reuniões', 'ranking de atendentes', etc. Combine com get_agenda_metrics se precisar dos totais agregados.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        agendaIds: z.array(z.string()).optional(),
        trackingIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        fromIso,
        toIso,
        agendaIds,
        trackingIds,
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

        const from = fromIso
          ? new Date(fromIso)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = toIso ? new Date(toIso) : new Date();

        const apptWhere = {
          agenda: {
            organizationId: { in: targetOrgs },
            ...(agendaIds && agendaIds.length > 0
              ? { id: { in: agendaIds } }
              : {}),
          },
          ...(trackingIds && trackingIds.length > 0
            ? { trackingId: { in: trackingIds } }
            : {}),
          startsAt: { gte: from, lte: to },
        };

        const grouped = await prisma.appointment.groupBy({
          by: ["userId"],
          where: apptWhere,
          _count: { _all: true },
        });

        const userIds = grouped
          .map((g) => g.userId)
          .filter((id): id is string => id !== null);
        const users =
          userIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true },
              })
            : [];
        const userMap = new Map(users.map((u) => [u.id, u]));

        const sorted = grouped
          .map((g) => ({
            userId: g.userId,
            name: g.userId
              ? userMap.get(g.userId)?.name ?? "(usuário removido)"
              : "(sem criador)",
            email: g.userId ? userMap.get(g.userId)?.email ?? "—" : "—",
            count: g._count._all,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit ?? 20);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "Colaboradores que criaram agendamentos",
          caption: `${sorted.length} colaborador(es) — período ${from.toLocaleDateString("pt-BR")} a ${to.toLocaleDateString("pt-BR")}`,
          totalCount: sorted.length,
          columns: [
            { key: "name", label: "Nome" },
            { key: "email", label: "Email" },
            { key: "count", label: "Agendamentos", type: "number" },
          ],
          rows: sorted.map((r) => ({
            id: r.userId ?? "none",
            name: r.name,
            email: r.email,
            count: r.count,
          })),
        };
        return payload;
      },
    }),

    // ── FORGE CONTRACTS ───────────────────────────────────────────────────
    list_contracts: tool({
      description:
        "Lista contratos Forge (ForgeContract) com filtros + tabela. Cols: número, cliente, valor, status, criado por, data de criação. Filtros: empresa, período, status, criadores. Linha abre /forge (sem deep-link interno ainda). Use quando o user pedir 'lista de contratos', 'contratos fechados', 'contratos ativos'.",
      inputSchema: z.object({
        orgIds: z.array(z.string()).optional(),
        fromIso: z.string().optional(),
        toIso: z.string().optional(),
        statuses: z
          .array(z.enum(["ATIVO", "ENCERRADO", "CANCELADO", "PENDENTE_ASSINATURA"]))
          .optional(),
        createdByIds: z
          .array(z.string())
          .optional()
          .describe("Filtra contratos criados por estes users."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({
        orgIds,
        fromIso,
        toIso,
        statuses,
        createdByIds,
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
          ...(createdByIds && createdByIds.length > 0
            ? { createdById: { in: createdByIds } }
            : {}),
          ...(fromIso || toIso
            ? {
                createdAt: {
                  ...(fromIso ? { gte: new Date(fromIso) } : {}),
                  ...(toIso ? { lte: new Date(toIso) } : {}),
                },
              }
            : {}),
        };

        const [contracts, totalCount] = await Promise.all([
          prisma.forgeContract.findMany({
            where,
            select: {
              id: true,
              number: true,
              status: true,
              value: true,
              createdAt: true,
              proposal: {
                select: { client: { select: { name: true } } },
              },
              createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit ?? 20,
          }),
          prisma.forgeContract.count({ where }),
        ]);

        const payload: AstroTablePayload = {
          kind: "astro_table",
          entityType: "contract",
          title: "Contratos",
          caption: `${totalCount} contrato(s)`,
          totalCount,
          columns: [
            { key: "number", label: "Nº", type: "number" },
            { key: "client", label: "Cliente" },
            { key: "value", label: "Valor", type: "currency" },
            { key: "status", label: "Status", type: "badge" },
            { key: "creator", label: "Criado por" },
            { key: "createdAt", label: "Criado em", type: "date" },
          ],
          rows: contracts.map((c) => ({
            id: c.id,
            number: c.number,
            client: c.proposal?.client?.name ?? "—",
            // value é Decimal de reais → multiplica por 100 pra renderer "currency"
            value: Math.round(Number(c.value) * 100),
            status: c.status,
            creator: c.createdBy?.name ?? "—",
            createdAt: c.createdAt.toISOString(),
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
