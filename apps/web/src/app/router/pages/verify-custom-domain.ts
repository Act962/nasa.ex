import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { promises as dns } from "node:dns";
import z from "zod";

export const verifyCustomDomain = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/domain/verify",
    summary: "Verificar TXT + CNAME do domínio externo",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: {
        id: true,
        customDomain: true,
        domainVerifyToken: true,
        domainStatus: true,
      },
    });
    if (!page || !page.customDomain || !page.domainVerifyToken) {
      throw errors.BAD_REQUEST({ message: "Domínio não configurado" });
    }

    const txtHost = `_nasa-verify.${page.customDomain}`;
    let ok = false;
    try {
      const txtRecords = await dns.resolveTxt(txtHost);
      ok = txtRecords.some((rows) => rows.join("").trim() === page.domainVerifyToken);
    } catch {
      ok = false;
    }

    const updated = await prisma.nasaPage.update({
      where: { id: page.id },
      data: { domainStatus: ok ? "VERIFIED" : "FAILED" },
      select: { customDomain: true, domainStatus: true },
    });
    return { verified: ok, page: updated };
  });
