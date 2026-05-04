import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";

/**
 * Procedures de termos do parceiro: SEM `requirePartnerMiddleware`
 * pois o aceite é exigido ANTES de habilitar acesso ao painel.
 */
export const getActiveTerms = base
  .route({
    method: "GET",
    summary: "Partner — Versão ativa dos termos",
    tags: ["Partner", "Terms"],
  })
  .output(
    z.object({
      version: z
        .object({
          id: z.string(),
          version: z.string(),
          title: z.string(),
          changeSummary: z.string().nullable(),
          effectiveAt: z.string(),
          contentHash: z.string(),
          spaceHelpTrackId: z.string().nullable(),
        })
        .nullable(),
      alreadyAccepted: z.boolean(),
    }),
  )
  .handler(async ({ context, errors }) => {
    const session = await auth.api.getSession({ headers: context.headers });
    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    const active = await prisma.partnerTermsVersion.findFirst({
      where: { isActive: true },
      orderBy: { effectiveAt: "desc" },
    });
    if (!active) return { version: null, alreadyAccepted: false };

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    return {
      version: {
        id: active.id,
        version: active.version,
        title: active.title,
        changeSummary: active.changeSummary,
        effectiveAt: active.effectiveAt.toISOString(),
        contentHash: active.contentHash,
        spaceHelpTrackId: active.spaceHelpTrackId,
      },
      alreadyAccepted: partner?.acceptedTermsVersionId === active.id,
    };
  });

export const acceptTerms = base
  .route({
    method: "POST",
    summary: "Partner — Aceitar termos",
    tags: ["Partner", "Terms"],
  })
  .input(z.object({ termsVersionId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const session = await auth.api.getSession({ headers: context.headers });
    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    const version = await prisma.partnerTermsVersion.findUnique({
      where: { id: input.termsVersionId },
    });
    if (!version) {
      throw errors.NOT_FOUND({ message: "Versão de termos não encontrada" });
    }
    if (!version.isActive) {
      throw errors.BAD_REQUEST({
        message: "Esta versão de termos não está mais ativa",
      });
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });
    if (!partner) {
      throw errors.FORBIDDEN({
        message: "Você ainda não é um parceiro NASA",
      });
    }

    const ip =
      context.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      context.headers.get("x-real-ip") ??
      null;
    const ua = context.headers.get("user-agent") ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.partnerTermsAcceptance.upsert({
        where: {
          partnerId_termsVersionId: {
            partnerId: partner.id,
            termsVersionId: version.id,
          },
        },
        update: {
          acceptedAt: new Date(),
          ipAddress: ip,
          userAgent: ua,
          contentHashAtTime: version.contentHash,
        },
        create: {
          partnerId: partner.id,
          termsVersionId: version.id,
          ipAddress: ip,
          userAgent: ua,
          contentHashAtTime: version.contentHash,
        },
      });
      await tx.partner.update({
        where: { id: partner.id },
        data: {
          acceptedTermsVersionId: version.id,
          acceptedTermsAt: new Date(),
        },
      });
    });

    const orgId =
      session.session.activeOrganizationId ??
      (
        await prisma.member.findFirst({
          where: { userId: session.user.id },
          select: { organizationId: true },
        })
      )?.organizationId;
    if (orgId) {
      await logActivity({
        organizationId: orgId,
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        userImage: (session.user as any).image,
        appSlug: "partner",
        subAppSlug: "partner-terms",
        featureKey: "partner.terms.accepted",
        action: "partner.terms.accepted",
        actionLabel: `Aceitou os Termos do programa NASA Parceiros (v${version.version})`,
        resource: version.title,
        resourceId: version.id,
        metadata: { version: version.version, contentHash: version.contentHash },
      });
    }

    return { success: true };
  });

export const getMyAcceptanceHistory = base
  .route({
    method: "GET",
    summary: "Partner — Meu histórico de aceites",
    tags: ["Partner", "Terms"],
  })
  .output(
    z.object({
      acceptances: z.array(
        z.object({
          id: z.string(),
          version: z.string(),
          versionTitle: z.string(),
          acceptedAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context, errors }) => {
    const session = await auth.api.getSession({ headers: context.headers });
    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });
    if (!partner) return { acceptances: [] };

    const rows = await prisma.partnerTermsAcceptance.findMany({
      where: { partnerId: partner.id },
      orderBy: { acceptedAt: "desc" },
      include: {
        termsVersion: { select: { version: true, title: true } },
      },
    });
    return {
      acceptances: rows.map((a) => ({
        id: a.id,
        version: a.termsVersion.version,
        versionTitle: a.termsVersion.title,
        acceptedAt: a.acceptedAt.toISOString(),
      })),
    };
  });
