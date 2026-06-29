import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { issueCertificate } from "../utils";

/**
 * Lista certificados do aluno logado.
 * Backfill: se houver enrollments completed sem certificate, emite agora.
 */
export const listMyCertificates = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const completedEnrollments = await prisma.nasaRouteEnrollment.findMany({
      where: { userId, status: "active", completedAt: { not: null } },
      select: { id: true, certificate: { select: { id: true } } },
    });
    const missing = completedEnrollments.filter((e) => !e.certificate);
    if (missing.length > 0) {
      await Promise.all(
        missing.map((e) =>
          issueCertificate({ enrollmentId: e.id }).catch((err) => {
            console.error("[list-my-certificates] backfill error:", err);
            return null;
          }),
        ),
      );
    }

    const certificates = await prisma.nasaRouteCertificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        code: true,
        studentName: true,
        courseTitle: true,
        orgName: true,
        durationMin: true,
        issuedAt: true,
        course: {
          select: {
            id: true,
            slug: true,
            coverUrl: true,
            creatorOrg: { select: { slug: true, name: true, logo: true } },
          },
        },
      },
    });

    return { certificates };
  });
