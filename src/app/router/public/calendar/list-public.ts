import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const EventCategoryEnum = z.enum([
  "WORKSHOP", "PALESTRA", "LANCAMENTO", "WEBINAR", "NETWORKING",
  "CURSO", "REUNIAO", "HACKATHON", "CONFERENCIA", "OUTRO",
]);

export const listPublic = base
  .input(
    z.object({
      country: z.string().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
      category: EventCategoryEnum.optional(),
      organizationId: z.string().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
      search: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(30),
    }),
  )
  .handler(async ({ input }) => {
    const now = new Date();
    const where = {
      isPublic: true,
      isArchived: false,
      isGuestDraft: false,
      publishedAt: { not: null, lte: now },
      ...(input.country ? { country: input.country } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.category ? { eventCategory: input.category } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.from || input.to
        ? {
            startDate: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: "insensitive" as const } },
              { description: { contains: input.search, mode: "insensitive" as const } },
            ],
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
        dueDate: true,
        publishedAt: true,
        eventCategory: true,
        country: true,
        state: true,
        city: true,
        address: true,
        viewCount: true,
        likesCount: true,
        shareCount: true,
        registrationUrl: true,
        youtubeUrl: true,
        links: true,
        attachments: true,
        organization: { select: { id: true, name: true, logo: true } },
        user: { select: { id: true, name: true, image: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    let nextCursor: string | null = null;
    if (events.length > input.limit) {
      const nextItem = events.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { events, nextCursor };
  });
