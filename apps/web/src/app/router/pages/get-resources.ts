import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

export const getPageResources = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/resources",
    summary: "Recursos linkáveis da org (trackings, forms, agendas, linnker, forge)",
  })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true, logo: true },
    });

    const [trackings, forms, agendas, linnkerPages] = await Promise.all([
      prisma.tracking.findMany({
        where: { organizationId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.form.findMany({
        where: { organizationId, published: true },
        select: { id: true, name: true, shareUrl: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agenda.findMany({
        where: { organizationId },
        select: { id: true, name: true, slug: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.linnkerPage.findMany({
        where: { organizationId },
        select: { id: true, slug: true, title: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      trackings,
      forms,
      agendas,
      linnkerPages,
      orgSlug: org?.slug ?? "",
      orgLogo: org?.logo ?? null,
    };
  });
