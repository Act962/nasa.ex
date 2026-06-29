import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const PermissionSchema = z.object({
  id:        z.string(),
  role:      z.string(),
  appKey:    z.string(),
  canView:   z.boolean(),
  canCreate: z.boolean(),
  canEdit:   z.boolean(),
  canDelete: z.boolean(),
});

export const getOrgPermissions = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — Get org permissions", tags: ["Admin"] })
  .input(z.object({ orgId: z.string() }))
  .output(z.array(PermissionSchema))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true },
    });
    if (!org) throw errors.NOT_FOUND;

    const perms = await prisma.orgPermission.findMany({
      where: { organizationId: input.orgId },
      select: {
        id: true, role: true, appKey: true,
        canView: true, canCreate: true, canEdit: true, canDelete: true,
      },
      orderBy: [{ role: "asc" }, { appKey: "asc" }],
    });

    return perms;
  });
