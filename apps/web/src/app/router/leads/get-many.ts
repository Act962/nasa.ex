import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { deriveResponseState } from "@/features/form/lib/form-response-state";
import { buildResponseSlug } from "@/features/form/lib/response-slug";
import {
  extractDeadlineConfigsFromResponse,
  isDeadlineFulfilled,
} from "@/features/form/lib/extract-deadline";

const sortOptions = z.enum([
  "order",
  "createdAt",
  "updatedAt",
  "statusEnteredAt",
]);
type SortOption = z.infer<typeof sortOptions>;

function buildOrderBy(sortBy: SortOption) {
  const map: Record<SortOption, object[]> = {
    order: [{ order: "asc" }, { id: "asc" }],
    createdAt: [{ createdAt: "desc" }, { id: "asc" }],
    updatedAt: [{ updatedAt: "desc" }, { id: "asc" }],
    // `statusEnteredAt` pode ser null em leads antigos — Postgres ordena
    // NULLS LAST por default no DESC, então leads sem o campo vão pro fim
    // naturalmente. Fallback (`id asc`) garante determinismo entre empates.
    statusEnteredAt: [{ statusEnteredAt: "desc" }, { id: "asc" }],
  };
  return map[sortBy];
}

function buildCursorWhere(
  sortBy: SortOption,
  cursorId?: string,
  cursorValue?: string,
) {
  if (!cursorId || !cursorValue) return {};

  if (sortBy === "createdAt") {
    return {
      OR: [
        { createdAt: { lt: new Date(cursorValue) } },
        { createdAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  if (sortBy === "updatedAt") {
    return {
      OR: [
        { updatedAt: { lt: new Date(cursorValue) } },
        { updatedAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  if (sortBy === "statusEnteredAt") {
    return {
      OR: [
        { statusEnteredAt: { lt: new Date(cursorValue) } },
        { statusEnteredAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  // order (Decimal asc)
  return {
    OR: [
      { order: { gt: Number(cursorValue) } },
      { order: Number(cursorValue), id: { gt: cursorId } },
    ],
  };
}

export const listLeadsByStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List leads by status with cursor pagination",
    tags: ["Leads"],
  })
  .input(
    z.object({
      statusId: z.string(),
      trackingId: z.string(),
      sortBy: sortOptions.default("order"),
      cursorId: z.string().optional(),
      cursorValue: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      dateInit: z.string().optional(),
      dateEnd: z.string().optional(),
      participantFilter: z.string().optional(),
      tagsFilter: z.array(z.string()).optional(),
      temperatureFilter: z.array(z.string()).optional(),
      actionFilter: z.enum(["ACTIVE", "WON", "LOST", "DELETED"]).optional(),
      projectsFilter: z.array(z.string()).optional(),
      statusFlowFilter: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const {
      statusId,
      trackingId,
      sortBy,
      cursorId,
      cursorValue,
      limit,
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
      projectsFilter,
      statusFlowFilter,
    } = input;

    const leads = await prisma.lead.findMany({
      where: {
        statusId,
        trackingId,
        currentAction: actionFilter || "ACTIVE",
        ...buildCursorWhere(sortBy, cursorId, cursorValue),
        ...(dateInit &&
          dateEnd && {
            createdAt: {
              gte: new Date(dateInit),
              lte: new Date(dateEnd),
            },
          }),
        ...(participantFilter && {
          responsible: {
            email: participantFilter,
          },
        }),
        ...(tagsFilter &&
          tagsFilter.length > 0 && {
            leadTags: {
              some: {
                tag: {
                  slug: {
                    in: tagsFilter,
                  },
                },
              },
            },
          }),
        ...(temperatureFilter &&
          temperatureFilter.length > 0 && {
            temperature: {
              in: temperatureFilter as any,
            },
          }),
        ...(projectsFilter &&
          projectsFilter.length > 0 && {
            orgProjectId: {
              in: projectsFilter,
            },
          }),
        ...(statusFlowFilter &&
          statusFlowFilter.length > 0 && {
            statusFlow: {
              in: statusFlowFilter as any,
            },
          }),
      },
      orderBy: buildOrderBy(sortBy),
      take: limit + 1,
      select: {
        id: true,
        isActive: true,
        currentAction: true,
        name: true,
        nickname: true,
        email: true,
        phone: true,
        order: true,
        statusId: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        temperature: true,
        statusFlow: true,
        profile: true,
        // Campos novos: existem no client após `prisma generate` rodar pós-migration
        ...({ slaDeadline: true, statusEnteredAt: true } as any),
        responsible: {
          select: {
            image: true,
            name: true,
          },
        },
        // Conversation do lead — usado pelo ícone WhatsApp do card pra
        // direcionar pro chat (substituiu o ícone "Em atendimento").
        conversation: {
          select: { id: true },
        },
        // Form responses do lead — usados pra renderizar os ícones de
        // estado do formulário no card. Carregamos jsonResponse +
        // jsonBlock pra derivar o estado SERVER-SIDE; só o resumo
        // (formId, name, state, slug) volta pro cliente, evitando que
        // dados grandes (jsonBlock pesado) viajem na rede do kanban.
        formResponses: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            jsonResponse: true,
            form: {
              select: {
                id: true,
                name: true,
                jsonBlock: true,
              },
            },
          },
        },
        leadTags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                slug: true,
              },
            },
          },
        },
        // Próximo appointment futuro do lead — usado pelo ícone de agenda
        // no card do board. Só PENDING/CONFIRMED contam (cancelados não).
        // `take: 1` garante payload mínimo; orderBy ASC pega o mais próximo.
        appointments: {
          where: {
            startsAt: { gte: new Date() },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          orderBy: { startsAt: "asc" },
          take: 1,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            title: true,
            meetingType: true,
            agenda: { select: { id: true, name: true } },
          },
        },
      },

    });

    let nextCursorId: string | undefined;
    let nextCursorValue: string | undefined;

    if (leads.length > limit) {
      leads.pop();
      const last = leads[leads.length - 1] as unknown as {
        id: string;
        order: { toString(): string };
        createdAt: Date;
        updatedAt: Date;
        statusEnteredAt: Date | null;
      };
      nextCursorId = last.id;
      if (sortBy === "order") {
        nextCursorValue = last.order.toString();
      } else if (sortBy === "statusEnteredAt") {
        // Pode ser null em leads antigos — usa createdAt como fallback
        // (mesma data que o card mostra nesse caso).
        nextCursorValue = (last.statusEnteredAt ?? last.createdAt).toISOString();
      } else {
        nextCursorValue = last[sortBy].toISOString();
      }
    }

    // Batch fetch dos eventos relevantes pros leads desta página — usados
    // pra cruzar com `resetTriggers` dos DatePickers e ocultar deadlines
    // que já foram "cumpridos" (status mudou, tag adicionada, form
    // submetido depois do form com a data). 1 query pros 50 leads,
    // indexed por (leadId, occurredAt). N+1 evitado.
    //
    // Type cast explícito: o Prisma client pós-merge da main passou a
    // inferir `l.id` como union complexa (provável stale generated types
    // após mudanças de schema). Como sabemos que `id` é sempre string no
    // model Lead, cast aqui em vez de regenerar o client.
    const leadIds: string[] = leads.map(
      (l) => (l as unknown as { id: string }).id,
    );
    const triggerEvents = leadIds.length
      ? await prisma.leadJourneyEvent.findMany({
          where: {
            leadId: { in: leadIds },
            kind: { in: ["status_changed", "tag_added", "form_submit"] },
          },
          select: {
            leadId: true,
            kind: true,
            occurredAt: true,
            metadata: true,
          },
        })
      : [];
    const eventsByLead = new Map<
      string,
      Array<{ kind: string; occurredAt: Date; metadata: unknown }>
    >();
    for (const e of triggerEvents) {
      const arr = eventsByLead.get(e.leadId) ?? [];
      arr.push({
        kind: e.kind,
        occurredAt: e.occurredAt,
        metadata: e.metadata,
      });
      eventsByLead.set(e.leadId, arr);
    }

    return {
      leads: leads.map((lead) => {
        // Deriva estado server-side pra cada formResponse e remove
        // jsonResponse/jsonBlock do payload (são dados pesados).
        const rawResponses = (
          lead as unknown as {
            formResponses?: Array<{
              id: string;
              createdAt: Date;
              jsonResponse: unknown;
              form: { id: string; name: string; jsonBlock: string };
            }>;
          }
        ).formResponses ?? [];

        const responses = rawResponses.map((r) => ({
          responseId: r.id,
          createdAt: r.createdAt,
          formId: r.form.id,
          formName: r.form.name,
          state: deriveResponseState({
            jsonResponse: r.jsonResponse,
            jsonBlock: r.form.jsonBlock,
            createdAt: r.createdAt,
          }),
          // slug legível pra URL de edit (`/formulario/<slug>/<id>`).
          slug: buildResponseSlug(r.form.name, r.createdAt),
        }));

        // deadlineHint: computa o prazo MAIS URGENTE entre todos os
        // forms do lead. Prefere prazos não-vencidos (o mais próximo);
        // se TODOS estiverem vencidos, mostra o mais recentemente vencido.
        // Computed-on-the-fly — sem mudar schema do banco. UI usa pra
        // mostrar badge no card do kanban.
        //
        // Filtra prazos CUMPRIDOS via `resetTriggers` (configurado no
        // DatePicker): se algum evento (status mudou / tag adicionada /
        // form submetido) configurado como trigger aconteceu APÓS a
        // criação do response, o prazo some.
        const leadEvents =
          eventsByLead.get((lead as unknown as { id: string }).id) ?? [];
        const allDeadlines = rawResponses
          .flatMap((r) => {
            const configs = extractDeadlineConfigsFromResponse({
              jsonResponse: r.jsonResponse,
              jsonBlock: r.form.jsonBlock,
            });
            return configs
              .filter(
                (c) =>
                  !isDeadlineFulfilled({
                    resetTriggers: c.resetTriggers,
                    leadEvents,
                    formCreatedAt: r.createdAt,
                    jsonResponse: r.jsonResponse,
                  }),
              )
              .map((c) => ({ date: c.date, formName: r.form.name }));
          });
        const now = Date.now();
        const future = allDeadlines
          .filter((x) => x.date.getTime() >= now)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        const past = allDeadlines
          .filter((x) => x.date.getTime() < now)
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        const picked = future[0] ?? past[0] ?? null;
        const deadlineHint = picked
          ? {
              deadline: picked.date.toISOString(),
              formName: picked.formName,
              expired: picked.date.getTime() < now,
            }
          : null;

        // Remove os fields originais grandes do payload final.
        // Também extrai `appointments` (lista) e remapeia pra `nextAppointment`
        // (único objeto ou null) — o card só precisa do próximo agendamento.
        const {
          formResponses: _strip,
          appointments: leadAppointments,
          ...rest
        } = lead as unknown as {
          formResponses?: unknown;
          appointments?: Array<{
            id: string;
            startsAt: Date;
            endsAt: Date;
            title: string | null;
            meetingType: "ONLINE" | "IN_PERSON";
            agenda: { id: string; name: string };
          }>;
        } & typeof lead;
        const next = leadAppointments?.[0] ?? null;
        const nextAppointment = next
          ? {
              id: next.id,
              startsAt: next.startsAt.toISOString(),
              endsAt: next.endsAt.toISOString(),
              title: next.title,
              meetingType: next.meetingType,
              agendaName: next.agenda.name,
            }
          : null;
        return {
          ...rest,
          order: lead.order.toString(),
          forms: responses,
          deadlineHint,
          nextAppointment,
        };
      }),
      nextCursorId,
      nextCursorValue,
    };
  });
