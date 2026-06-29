import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const setOrgPermission = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Set org permission", tags: ["Admin"] })
  .input(z.object({
    orgId:     z.string(),
    role:      z.string(),
    appKey:    z.string(),
    canView:   z.boolean(),
    canCreate: z.boolean(),
    canEdit:   z.boolean(),
    canDelete: z.boolean(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true },
    });
    if (!org) throw errors.NOT_FOUND;

    await prisma.orgPermission.upsert({
      where: {
        organizationId_role_appKey: {
          organizationId: input.orgId,
          role:           input.role,
          appKey:         input.appKey,
        },
      },
      create: {
        organizationId: input.orgId,
        role:           input.role,
        appKey:         input.appKey,
        canView:        input.canView,
        canCreate:      input.canCreate,
        canEdit:        input.canEdit,
        canDelete:      input.canDelete,
      },
      update: {
        canView:   input.canView,
        canCreate: input.canCreate,
        canEdit:   input.canEdit,
        canDelete: input.canDelete,
      },
    });

    return { success: true };
  });
