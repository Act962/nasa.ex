import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

const EventCategoryEnum = z.enum([
  "WORKSHOP",
  "PALESTRA",
  "LANCAMENTO",
  "WEBINAR",
  "NETWORKING",
  "CURSO",
  "REUNIAO",
  "HACKATHON",
  "CONFERENCIA",
  "OUTRO",
]);

/**
 * Calendário PRÓPRIO da empresa — só ações onde `orgId = org.id` e
 * `isPublic = true`. NÃO reutiliza a query global `/calendario`.
 * A global continua intocada.
 */
export const listSpaceActions = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      from: z.date().optional(),
      to: z.date().optional(),
      category: EventCategoryEnum.optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ input, context }) => {
    const { organization } = context;

    const where = {
      organizationId: organization.id,
      isPublic: true,
      isArchived: false,
      isGuestDraft: false,
      publishedAt: { not: null },
      ...(input.category ? { eventCategory: input.category } : {}),
      ...(input.from || input.to
        ? {
            startDate: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    };

    const events = await prisma.action.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { publishedAt: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        publicSlug: true,
        title: true,
        description: true,
        coverImage: true,
        startDate: true,
        endDate: true,
        publishedAt: true,
        eventCategory: true,
        city: true,
        state: true,
        address: true,
        viewCount: true,
        likesCount: true,
        registrationUrl: true,
      },
    });

    let nextCursor: string | null = null;
    if (events.length > input.limit) {
      const next = events.pop();
      nextCursor = next?.id ?? null;
    }

    return { events, nextCursor };
  });
