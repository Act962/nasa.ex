import { base } from "@/app/middlewares/base";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";

/**
 * Validação pública de certificado pelo código (ex: NR-XXXXXXXX).
 * Não exige autenticação. Não retorna dados sensíveis.
 */
export const publicGetCertificate = base
  .input(z.object({ code: z.string().trim().min(1).max(40) }))
  .handler(async ({ input }) => {
    const cert = await prisma.nasaRouteCertificate.findUnique({
      where: { code: input.code },
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
            slug: true,
            coverUrl: true,
            creatorOrg: { select: { slug: true, name: true, logo: true } },
          },
        },
      },
    });
    if (!cert) {
      throw new ORPCError("NOT_FOUND", { message: "Certificado não encontrado" });
    }
    return { certificate: cert };
  });
