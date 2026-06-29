import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Cria um WorldEvent dentro de uma SpaceStation.
 *
 * Regras:
 *   - Quem cria deve ser dono da station (user-station) ou admin/owner
 *     da org dona da station (org-station).
 *   - `slug` deve ser único globalmente; geramos auto se não vier.
 *   - Mapa: se `worldTemplateId` for passado, copia `mapData` dele. Senão,
 *     usa um placeholder mínimo (organizador edita depois).
 */
export const createWorldEvent = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/world-events/create",
    summary: "Cria um WorldEvent na station do user/org",
  })
  .input(
    z.object({
      stationId: z.string(),
      slug: z
        .string()
        .min(3)
        .max(60)
        .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífens.")
        .optional(),
      title: z.string().min(3).max(120),
      description: z.string().max(2000).optional(),
      coverUrl: z.string().url().optional(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      worldTemplateId: z.string().optional(),
      capacity: z.number().int().min(2).max(50_000).default(200),
      ticketPriceStars: z.number().int().min(0).optional(),
      ticketPriceBrl: z.number().min(0).optional(),
      isFree: z.boolean().default(false),
      isPublic: z.boolean().default(true),
      payoutPercent: z.number().int().min(0).max(95).default(90),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      slug: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const station = await prisma.spaceStation.findUnique({
      where: { id: input.stationId },
      select: { id: true, userId: true, orgId: true },
    });
    if (!station) throw errors.NOT_FOUND({ message: "Station não encontrada." });

    // Autorização
    const isStationOwner =
      station.userId === context.user.id ||
      (station.orgId !== null &&
        station.orgId === context.session.activeOrganizationId);
    if (!isStationOwner) {
      throw errors.FORBIDDEN({
        message: "Só o dono da Station pode criar eventos nela.",
      });
    }

    // Validação de janela
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw errors.BAD_REQUEST({
        message: "endsAt precisa ser depois de startsAt.",
      });
    }

    // Slug: gera default se não veio
    const slug =
      input.slug ??
      `${(input.title ?? "evento")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)}-${Date.now().toString(36)}`;

    // mapData: do template ou placeholder
    let mapData: Prisma.InputJsonValue = {};
    let worldTemplateId: string | null = null;
    if (input.worldTemplateId) {
      const tpl = await prisma.worldTemplate.findUnique({
        where: { id: input.worldTemplateId },
        select: { id: true, mapData: true },
      });
      if (!tpl) {
        throw errors.BAD_REQUEST({ message: "Template não encontrado." });
      }
      mapData = (tpl.mapData ?? {}) as Prisma.InputJsonValue;
      worldTemplateId = tpl.id;
    }

    const created = await prisma.worldEvent.create({
      data: {
        stationId: station.id,
        slug,
        title: input.title,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        startsAt,
        endsAt,
        mapData,
        worldTemplateId,
        capacity: input.capacity,
        ticketPriceStars: input.isFree ? null : input.ticketPriceStars ?? null,
        // Prisma aceita number direto pra colunas Decimal (converte pra DecimalJS internamente).
        ticketPriceBrl: input.isFree ? null : input.ticketPriceBrl ?? null,
        isFree: input.isFree,
        isPublic: input.isPublic,
        payoutPercent: input.payoutPercent,
        zones: [],
        status: "SCHEDULED",
        createdBy: context.user.id,
      },
      select: { id: true, slug: true },
    });

    return created;
  });
