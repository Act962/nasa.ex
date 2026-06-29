import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import {
  ensurePartner,
  getOrCreateReferralLink,
} from "@/features/partner/lib/partner-service";
import { PartnerStatus } from "@/generated/prisma/client";

const adminBase = base.use(requireAdminMiddleware);

const TierZ = z.enum([
  "SUITE",
  "EARTH",
  "GALAXY",
  "CONSTELLATION",
  "INFINITY",
]);

/**
 * Promove um usuário a parceiro manualmente (sem aguardar 10 orgs).
 * Marca `manualTierOverride = true` e registra evento em PartnerTierHistory.
 */
export const promoteUser = adminBase
  .route({
    method: "POST",
    summary: "Admin — Promove usuário a parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      userId: z.string(),
      initialTier: TierZ.default("SUITE"),
      activate: z.boolean().default(true),
      notes: z.string().optional(),
    }),
  )
  .output(z.object({ partnerId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) throw errors.NOT_FOUND({ message: "Usuário não encontrado" });

    // Garantia de link
    await getOrCreateReferralLink(user.id);

    // Cria/recupera Partner
    const existing = await prisma.partner.findUnique({
      where: { userId: user.id },
    });
    const partner = existing
      ? await prisma.partner.update({
          where: { id: existing.id },
          data: {
            status: input.activate ? PartnerStatus.ACTIVE : existing.status,
            tier: input.initialTier,
            tierAchievedAt: new Date(),
            activatedAt: existing.activatedAt ?? new Date(),
            manualTierOverride: true,
            promotedByAdminId: context.adminUser.id,
            notes: input.notes ?? existing.notes,
          },
        })
      : await ensurePartner(user.id, {
          status: input.activate
            ? PartnerStatus.ACTIVE
            : PartnerStatus.ELIGIBLE,
          tier: input.initialTier,
          manual: true,
          promotedByAdminId: context.adminUser.id,
        });

    await prisma.partnerTierHistory.create({
      data: {
        partnerId: partner.id,
        fromTier: existing?.tier ?? null,
        toTier: input.initialTier,
        reason: "admin_manual",
        activeReferrals: 0,
        triggeredById: context.adminUser.id,
      },
    });

    if (input.notes && existing) {
      await prisma.partner.update({
        where: { id: partner.id },
        data: { notes: input.notes },
      });
    }

    return { partnerId: partner.id };
  });

/**
 * Busca usuários que ainda não são parceiros (ou já têm Partner mas
 * podem ter o tier ajustado), para o modal de promoção.
 */
export const searchUsersToPromote = adminBase
  .route({
    method: "GET",
    summary: "Admin — Busca usuários para virar parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ search: z.string().min(1).max(80) }))
  .output(
    z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
          alreadyPartner: z.boolean(),
          partnerStatus: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        partner: { select: { status: true } },
      },
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image ?? null,
        alreadyPartner: !!u.partner,
        partnerStatus: u.partner?.status ?? null,
      })),
    };
  });
