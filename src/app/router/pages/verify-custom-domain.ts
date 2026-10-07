import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { promises as dns } from "node:dns";
import { isDomainPointingToEdge } from "@/features/pages/server/custom-domain";
import z from "zod";

export const verifyCustomDomain = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/domain/verify",
    summary: "Verificar TXT de posse e apontamento (CNAME/A) do domínio externo",
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
    const publishedTxtValues = await dns
      .resolveTxt(txtHost)
      .then((txtRecords) => txtRecords.map((rows) => rows.join("").trim()))
      .catch(() => [] as string[]);
    const isOwnershipProven = publishedTxtValues.includes(page.domainVerifyToken);
    // Existe TXT no nome certo, mas com outro valor: quase sempre um código antigo colado no provedor.
    const hasOutdatedTxt = !isOwnershipProven && publishedTxtValues.length > 0;
    const isPointingToEdge = await isDomainPointingToEdge(page.customDomain);
    const ok = isOwnershipProven && isPointingToEdge;

    const updated = await prisma.nasaPage.update({
      where: { id: page.id },
      data: { domainStatus: ok ? "VERIFIED" : "FAILED" },
      select: { customDomain: true, domainStatus: true },
    });
    return { verified: ok, isOwnershipProven, hasOutdatedTxt, isPointingToEdge, page: updated };
  });
