import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { createHash } from "node:crypto";

const adminBase = base.use(requireAdminMiddleware);

function computeContentHash(parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

export const listTermsVersions = adminBase
  .route({
    method: "GET",
    summary: "Admin — Lista versões de termos do parceiro",
    tags: ["Admin", "Partner"],
  })
  .output(
    z.object({
      versions: z.array(
        z.object({
          id: z.string(),
          version: z.string(),
          title: z.string(),
          isActive: z.boolean(),
          effectiveAt: z.string(),
          changeSummary: z.string().nullable(),
          createdAt: z.string(),
          acceptancesCount: z.number(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const rows = await prisma.partnerTermsVersion.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { acceptances: true } } },
    });
    return {
      versions: rows.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        isActive: v.isActive,
        effectiveAt: v.effectiveAt.toISOString(),
        changeSummary: v.changeSummary,
        createdAt: v.createdAt.toISOString(),
        acceptancesCount: v._count.acceptances,
      })),
    };
  });

export const createTermsVersion = adminBase
  .route({
    method: "POST",
    summary: "Admin — Cria versão de termos (rascunho)",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      version: z.string().min(1),
      title: z.string().min(1),
      effectiveAt: z.string().datetime(),
      changeSummary: z.string().optional(),
      spaceHelpTrackId: z.string().optional(),
      contentParts: z.array(z.string()).default([]),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const hash = computeContentHash(
      input.contentParts.length ? input.contentParts : [input.title],
    );
    const v = await prisma.partnerTermsVersion.create({
      data: {
        version: input.version,
        title: input.title,
        effectiveAt: new Date(input.effectiveAt),
        changeSummary: input.changeSummary ?? null,
        spaceHelpTrackId: input.spaceHelpTrackId ?? null,
        contentHash: hash,
        publishedById: context.adminUser.id,
        isActive: false,
      },
    });
    return { id: v.id };
  });

export const publishTermsVersion = adminBase
  .route({
    method: "POST",
    summary: "Admin — Publica versão de termos (ativa)",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ versionId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const version = await prisma.partnerTermsVersion.findUnique({
      where: { id: input.versionId },
    });
    if (!version) throw errors.NOT_FOUND({ message: "Versão não encontrada" });

    await prisma.$transaction(async (tx) => {
      await tx.partnerTermsVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      await tx.partnerTermsVersion.update({
        where: { id: input.versionId },
        data: { isActive: true },
      });
    });

    // TODO: disparar evento Inngest 'partner-terms.version-published' para
    // notificar todos os parceiros ACTIVE (vide partner-grace-period-monitor).

    return { success: true };
  });

export const listAcceptancesByPartner = adminBase
  .route({
    method: "GET",
    summary: "Admin — Aceites de termos por parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ partnerId: z.string() }))
  .output(
    z.object({
      acceptances: z.array(
        z.object({
          id: z.string(),
          versionId: z.string(),
          version: z.string(),
          versionTitle: z.string(),
          acceptedAt: z.string(),
          ipAddress: z.string().nullable(),
          userAgent: z.string().nullable(),
          contentHashAtTime: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await prisma.partnerTermsAcceptance.findMany({
      where: { partnerId: input.partnerId },
      orderBy: { acceptedAt: "desc" },
      include: {
        termsVersion: { select: { version: true, title: true } },
      },
    });
    return {
      acceptances: rows.map((a) => ({
        id: a.id,
        versionId: a.termsVersionId,
        version: a.termsVersion.version,
        versionTitle: a.termsVersion.title,
        acceptedAt: a.acceptedAt.toISOString(),
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        contentHashAtTime: a.contentHashAtTime,
      })),
    };
  });
