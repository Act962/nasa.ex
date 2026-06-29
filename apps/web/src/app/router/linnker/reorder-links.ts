import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const reorderLinnkerLinks = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/linnker/links/reorder",
    summary: "Reorder links in a Linnker page",
  })
  .input(
    z.object({
      pageId: z.string(),
      orderedIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const page = await prisma.linnkerPage.findFirst({ where: { id: input.pageId, organizationId } });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    await Promise.all(
      input.orderedIds.map((id, index) =>
        prisma.linnkerLink.update({ where: { id }, data: { position: index } }),
      ),
    );

    return { message: "Links reordenados" };
  });
