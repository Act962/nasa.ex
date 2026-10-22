import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { LINNKER_VISIT_SCAN_WHERE } from "@/features/linnker/lib/visit-scans";

export const listLinnkerPages = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/linnker/pages",
    summary: "List Linnker pages for current org",
  })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const pages = await prisma.linnkerPage.findMany({
      where: { organizationId },
      include: {
        links: { orderBy: { position: "asc" } },
        _count: { select: { scans: { where: LINNKER_VISIT_SCAN_WHERE } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { pages };
  });
