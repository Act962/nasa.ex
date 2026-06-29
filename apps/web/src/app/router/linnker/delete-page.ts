import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteLinnkerPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/linnker/pages/:id",
    summary: "Delete a Linnker page",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const page = await prisma.linnkerPage.findFirst({ where: { id: input.id, organizationId } });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    await prisma.linnkerPage.delete({ where: { id: input.id } });

    return { message: "Página excluída com sucesso" };
  });
