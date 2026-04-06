import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { logActivity } from "@/lib/activity-logger";

export const deleteTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    summary: "Archive a tracking for 30 days before permanent deletion",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, errors, context }) => {
    const { user, org } = context;

    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
      include: {
        participants: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
    }

    // Check if user is owner of tracking or moderator of organization
    const isOwner = trackingExists.participants.some(
      (p) => p.role === "OWNER"
    );

    if (!isOwner) {
      const member = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: org.id,
          },
        },
      });

      if (!member || !["owner", "admin", "moderador"].includes(member.role)) {
        throw errors.FORBIDDEN;
      }
    }

    const result = await prisma.tracking.update({
      where: {
        id: input.trackingId,
      },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    // Log activity
    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: (user as any).image,
      appSlug: "tracking",
      action: "tracking.archived",
      actionLabel: `Arquivou o tracking "${result.name}"`,
      resource: result.name,
      resourceId: result.id,
    });

    return {
      trackingName: result.name,
    };
  });
