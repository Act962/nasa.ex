import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listSavedReports = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const reports = await prisma.savedInsightReport.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        modules: true,
        shareToken: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    return {
      reports: reports.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        modules: r.modules,
        shareToken: r.shareToken,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        author: r.createdBy,
      })),
    };
  });
