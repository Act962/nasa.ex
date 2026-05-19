import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Patch parcial de WorldEvent (admin/owner da station).
 *
 * Permite atualizar: título, descrição, cover, janela, capacidade, preço,
 * payout, zones e status. `mapData` é trocado só se vier explicitamente
 * (raramente — normalmente edita pelo editor visual da Station).
 */
export const updateWorldEvent = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/world-events/update",
    summary: "Atualiza um WorldEvent existente",
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(3).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
      coverUrl: z.string().url().nullable().optional(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      capacity: z.number().int().min(2).max(50_000).optional(),
      ticketPriceStars: z.number().int().min(0).nullable().optional(),
      ticketPriceBrl: z.number().min(0).nullable().optional(),
      isFree: z.boolean().optional(),
      isPublic: z.boolean().optional(),
      payoutPercent: z.number().int().min(0).max(95).optional(),
      zones: z.array(z.record(z.string(), z.unknown())).optional(),
      status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]).optional(),
      mapData: z.unknown().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.worldEvent.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        station: { select: { userId: true, orgId: true } },
      },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Evento não encontrado." });

    const station = existing.station;
    const isOwner =
      station?.userId === context.user.id ||
      (station?.orgId !== null &&
        station?.orgId === context.session.activeOrganizationId);
    if (!isOwner) {
      throw errors.FORBIDDEN({
        message: "Só o dono da Station host pode editar este evento.",
      });
    }

    const data: Prisma.WorldEventUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl;
    if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
    if (input.endsAt !== undefined) data.endsAt = new Date(input.endsAt);
    if (input.capacity !== undefined) data.capacity = input.capacity;
    if (input.ticketPriceStars !== undefined)
      data.ticketPriceStars = input.ticketPriceStars;
    if (input.ticketPriceBrl !== undefined)
      data.ticketPriceBrl = input.ticketPriceBrl;
    if (input.isFree !== undefined) data.isFree = input.isFree;
    if (input.isPublic !== undefined) data.isPublic = input.isPublic;
    if (input.payoutPercent !== undefined)
      data.payoutPercent = input.payoutPercent;
    if (input.zones !== undefined)
      data.zones = input.zones as unknown as Prisma.InputJsonValue;
    if (input.status !== undefined) data.status = input.status;
    if (input.mapData !== undefined)
      data.mapData = input.mapData as Prisma.InputJsonValue;

    const updated = await prisma.worldEvent.update({
      where: { id: input.id },
      data,
      select: { id: true },
    });

    return updated;
  });
