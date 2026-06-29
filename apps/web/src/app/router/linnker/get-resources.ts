import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

export const getLinnkerResources = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/linnker/resources",
    summary: "Get all linkable resources (trackings, forms, agendas)",
  })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true, logo: true },
    });

    // Busca logo da marca (NasaPlanner) como fallback
    let orgLogo: string | null = org?.logo ?? null;
    if (!orgLogo) {
      const planner = await prisma.nasaPlanner.findFirst({
        where: { organizationId },
        select: { logoSquare: true, logoLight: true, logoHorizontal: true },
      });
      orgLogo = planner?.logoSquare ?? planner?.logoLight ?? planner?.logoHorizontal ?? null;
    }

    const [trackings, forms, agendas] = await Promise.all([
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
    ]);

    return { trackings, forms, agendas, orgSlug: org?.slug ?? "", orgLogo };
  });
