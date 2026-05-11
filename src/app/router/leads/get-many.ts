import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { deriveResponseState } from "@/features/form/lib/form-response-state";
import { buildResponseSlug } from "@/features/form/lib/response-slug";

const sortOptions = z.enum(["order", "createdAt", "updatedAt"]);
type SortOption = z.infer<typeof sortOptions>;

function buildOrderBy(sortBy: SortOption) {
  const map: Record<SortOption, object[]> = {
    order: [{ order: "asc" }, { id: "asc" }],
    createdAt: [{ createdAt: "desc" }, { id: "asc" }],
    updatedAt: [{ updatedAt: "desc" }, { id: "asc" }],
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
      },

    });

    let nextCursorId: string | undefined;
    let nextCursorValue: string | undefined;

    if (leads.length > limit) {
      leads.pop();
      const last = leads[leads.length - 1];
      nextCursorId = last.id;
      nextCursorValue =
        sortBy === "order" ? last.order.toString() : last[sortBy].toISOString();
    }

    return {
      leads: leads.map((lead) => {
        // Deriva estado server-side pra cada formResponse e remove
        // jsonResponse/jsonBlock do payload (são dados pesados).
        const responses = (
          (lead as unknown as {
            formResponses?: Array<{
              id: string;
              createdAt: Date;
              jsonResponse: unknown;
              form: { id: string; name: string; jsonBlock: string };
            }>;
          }).formResponses ?? []
        ).map((r) => ({
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
        // Remove os fields originais grandes do payload final.
        const {
          formResponses: _strip,
          ...rest
        } = lead as unknown as { formResponses?: unknown } & typeof lead;
        return {
          ...rest,
          order: lead.order.toString(),
          forms: responses,
        };
      }),
      nextCursorId,
      nextCursorValue,
    };
  });
