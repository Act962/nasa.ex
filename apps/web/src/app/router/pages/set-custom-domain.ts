import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";
import z from "zod";

const domainRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export const setCustomDomain = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/domain",
    summary: "Registrar domínio externo (gera token + status PENDING)",
  })
  .input(
    z.object({
      id: z.string(),
      domain: z.string().regex(domainRegex, "Domínio inválido"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const normalized = input.domain.toLowerCase();
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true, customDomain: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const conflict = await prisma.nasaPage.findFirst({
      where: { customDomain: normalized, NOT: { id: page.id } },
      select: { id: true },
    });
    if (conflict) {
      throw errors.BAD_REQUEST({ message: "Este domínio já está em uso por outra página" });
    }

    const token = `nasa-${nanoid(24)}`;
    const updated = await prisma.nasaPage.update({
      where: { id: page.id },
      data: {
        customDomain: normalized,
        domainStatus: "PENDING",
        domainSource: "EXTERNAL",
        domainVerifyToken: token,
      },
      select: {
        id: true,
        customDomain: true,
        domainStatus: true,
        domainSource: true,
        domainVerifyToken: true,
      },
    });
    return { page: updated };
  });
