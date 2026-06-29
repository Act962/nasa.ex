import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Submissão pública de review — moderação obrigatória (§7.1).
 *
 * - Reviews criadas com `status=PENDING` — admin precisa aprovar.
 * - Autor pode ser anônimo; `ip_hash` é SHA-256 do IP (nunca IP cru).
 * - Rate limit simples: máximo 3 reviews por fingerprint/org nas últimas 24h.
 */
export const submitReview = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(120).optional(),
      comment: z.string().max(2000).optional(),
      authorName: z.string().max(80).optional(),
      fingerprint: z.string().max(120).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { organization } = context;

    const sessionData = await auth.api.getSession({ headers: context.headers });
    const authorId = sessionData?.user?.id ?? null;

    // IP hash (nunca IP cru)
    const ip =
      context.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      context.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex");

    // Rate limit leve (mesmo fingerprint ou ipHash + org nas últimas 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.companyReview.count({
      where: {
        orgId: organization.id,
        createdAt: { gte: since },
        OR: [
          input.fingerprint ? { fingerprint: input.fingerprint } : { id: "__nope__" },
          { ipHash },
        ],
      },
    });
    if (recentCount >= 3) {
      throw errors.BAD_REQUEST({
        message: "Muitas reviews em pouco tempo. Tente novamente mais tarde.",
      });
    }

    // Se autor logado for membro, marca como `verified`
    let verified = false;
    if (authorId) {
      const member = await prisma.member.findFirst({
        where: { userId: authorId, organizationId: organization.id },
        select: { id: true },
      });
      verified = !!member;
    }

    const review = await prisma.companyReview.create({
      data: {
        orgId: organization.id,
        authorId,
        authorName: input.authorName ?? null,
        rating: input.rating,
        title: input.title ?? null,
        comment: input.comment ?? null,
        verified,
        status: "PENDING", // explicit — moderação obrigatória
        ipHash,
        fingerprint: input.fingerprint ?? null,
      },
      select: { id: true, status: true, createdAt: true },
    });

    // Log de auditoria
    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: organization.id,
          actorId: authorId,
          action: "review_submitted",
          target: review.id,
          ipHash,
        },
      })
      .catch(() => null);

    return { reviewId: review.id, status: review.status };
  });
