import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import {
  createCommissionFromPayment,
  recalcReferralActivity,
  recalcPartnerTier,
} from "@/features/partner/lib/partner-service";

const adminBase = base.use(requireAdminMiddleware);

/**
 * Vincula uma org existente a um parceiro retroativamente.
 * Caso de uso: cliente se cadastrou direto, mas foi indicado offline.
 */
export const attachOrganization = adminBase
  .route({
    method: "POST",
    summary: "Admin — Vincula empresa a parceiro retroativamente",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      partnerId: z.string(),
      organizationId: z.string(),
      reason: z.string().optional(),
      backfillCommissions: z.boolean().default(false),
      force: z.boolean().default(false),
    }),
  )
  .output(
    z.object({
      referralId: z.string(),
      backfilledCount: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const partner = await prisma.partner.findUnique({
      where: { id: input.partnerId },
    });
    if (!partner) throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });

    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!org) throw errors.NOT_FOUND({ message: "Empresa não encontrada" });

    // Conflito: org já tem parceiro?
    const existing = await prisma.partnerReferral.findUnique({
      where: { referredOrganizationId: input.organizationId },
      include: {
        partnerUser: { select: { name: true, email: true } },
      },
    });
    if (existing && !input.force) {
      throw errors.BAD_REQUEST({
        message: `Empresa já vinculada ao parceiro ${existing.partnerUser.name}. Use force=true para transferir.`,
      });
    }

    // Bloqueia auto-indicação (parceiro tentando se vincular à própria org)
    const ownersInOrg = await prisma.member.findMany({
      where: { organizationId: input.organizationId },
      select: { userId: true },
    });
    if (ownersInOrg.some((m) => m.userId === partner.userId)) {
      throw errors.BAD_REQUEST({
        message: "Não é possível indicar uma empresa do próprio parceiro",
      });
    }

    let referralId: string;
    if (existing) {
      // Transferência forçada: atualiza partnerUserId
      const updated = await prisma.partnerReferral.update({
        where: { id: existing.id },
        data: {
          partnerUserId: partner.userId,
          source: "admin_manual",
          attachedByAdminId: context.adminUser.id,
          attachedReason: input.reason ?? "Transferido manualmente",
          linkId: null,
        },
      });
      referralId = updated.id;
    } else {
      const created = await prisma.partnerReferral.create({
        data: {
          partnerUserId: partner.userId,
          referredOrganizationId: input.organizationId,
          source: "admin_manual",
          attachedByAdminId: context.adminUser.id,
          attachedReason: input.reason ?? null,
        },
      });
      referralId = created.id;
    }

    // Backfill: gera PartnerCommission retroativos para pagamentos já confirmados
    let backfilledCount = 0;
    if (input.backfillCommissions) {
      const payments = await prisma.starsPayment.findMany({
        where: {
          organizationId: input.organizationId,
          status: "paid",
          partnerCommission: null,
        },
      });
      const pkgIds = Array.from(new Set(payments.map((p) => p.packageId)));
      const pkgs = await prisma.starPackage.findMany({
        where: { id: { in: pkgIds } },
      });
      const pkgById = new Map<string, (typeof pkgs)[number]>();
      for (const p of pkgs) pkgById.set(p.id, p);
      for (const p of payments) {
        const pkg = pkgById.get(p.packageId);
        if (!pkg) continue;
        const created = await createCommissionFromPayment({
          starsPaymentId: p.id,
          organizationId: p.organizationId,
          amountBrl: Number(p.amountBrl),
          package: {
            id: pkg.id,
            label: pkg.label,
            stars: pkg.stars,
            priceBrl: Number(pkg.priceBrl),
          },
        });
        if (created) backfilledCount++;
      }
    }

    // Recalcula atividade da nova referral + tier do parceiro
    await recalcReferralActivity(referralId);
    await recalcPartnerTier(partner.id, {
      triggeredById: context.adminUser.id,
    });

    return { referralId, backfilledCount };
  });

/**
 * Desvincula uma empresa de um parceiro.
 * Comissões já pagas NÃO são revertidas. Comissões PENDING viram CANCELLED.
 */
export const detachOrganization = adminBase
  .route({
    method: "POST",
    summary: "Admin — Desvincula empresa de parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      referralId: z.string(),
      reason: z.string().optional(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      cancelledCommissions: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const referral = await prisma.partnerReferral.findUnique({
      where: { id: input.referralId },
      include: {
        partnerUser: { select: { partner: true } },
      },
    });
    if (!referral) throw errors.NOT_FOUND({ message: "Referral não encontrado" });

    // Cancela comissões PENDING
    const pendingComms = await prisma.partnerCommission.findMany({
      where: {
        organizationId: referral.referredOrganizationId,
        partner: { userId: referral.partnerUserId },
        status: { in: ["PENDING", "READY"] },
      },
      select: { id: true, partnerId: true, commissionBrl: true, status: true },
    });

    let cancelled = 0;
    for (const c of pendingComms) {
      // Apenas PENDING — READY já foi para um payout
      if (c.status === "PENDING") {
        await prisma.partnerCommission.update({
          where: { id: c.id },
          data: { status: "CANCELLED" },
        });
        await prisma.partner.update({
          where: { id: c.partnerId },
          data: {
            totalEarnedBrl: { decrement: c.commissionBrl },
          },
        });
        cancelled++;
      }
    }

    await prisma.partnerReferral.delete({ where: { id: input.referralId } });

    if (referral.partnerUser.partner) {
      await recalcPartnerTier(referral.partnerUser.partner.id, {
        triggeredById: context.adminUser.id,
      });
    }

    if (input.reason) {
      // Log opcional como nota no parceiro
      const partner = referral.partnerUser.partner;
      if (partner) {
        await prisma.partner.update({
          where: { id: partner.id },
          data: {
            notes: partner.notes
              ? `${partner.notes}\n[detach] ${input.reason}`
              : `[detach] ${input.reason}`,
          },
        });
      }
    }

    return { success: true, cancelledCommissions: cancelled };
  });

export const searchOrgsToAttach = adminBase
  .route({
    method: "GET",
    summary: "Admin — Busca empresas para atribuir a parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ search: z.string().min(1).max(80) }))
  .output(
    z.object({
      organizations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          alreadyHasReferral: z.boolean(),
          currentPartnerName: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const orgs = await prisma.organization.findMany({
      where: {
        OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        partnerReferral: {
          include: {
            partnerUser: { select: { name: true } },
          },
        },
      },
    });

    return {
      organizations: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        alreadyHasReferral: !!o.partnerReferral,
        currentPartnerName: o.partnerReferral?.partnerUser.name ?? null,
      })),
    };
  });
