import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getLinnkerScans = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/linnker/pages/:id/scans",
    summary: "Get scans for a Linnker page",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const page = await prisma.linnkerPage.findFirst({ where: { id: input.id, organizationId } });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const scans = await prisma.linnkerScan.findMany({
      where: { pageId: input.id },
      include: { lead: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { scans };
  });
