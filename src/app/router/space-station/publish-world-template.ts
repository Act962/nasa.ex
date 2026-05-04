import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { TemplateCategory } from "@/generated/prisma/enums";
import z from "zod";

export const publishWorldTemplate = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/world-templates",
    summary: "Publish a world map as a shareable template",
  })
  .input(
    z.object({
      name:        z.string().min(1).max(80),
      description: z.string().max(500).optional(),
      category:    z.nativeEnum(TemplateCategory).default("OTHER"),
      mapData:     z.unknown(),
      previewUrl:  z.string().optional().nullable(),
      isPublic:    z.boolean().default(false),
      stationId:   z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const orgId = context.session.activeOrganizationId;
    const template = await prisma.worldTemplate.create({
      data: {
        name:        input.name,
        description: input.description,
        category:    input.category,
        mapData:     input.mapData as never,
        previewUrl:  input.previewUrl ?? null,
        isPublic:    input.isPublic,
        stationId:   input.stationId ?? null,
        authorId:    userId,
      },
    });

    if (orgId) {
      await logActivity({
        organizationId: orgId,
        userId,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "space-station",
        subAppSlug: "station-templates",
        featureKey: "station.template.published",
        action: "station.template.published",
        actionLabel: `Publicou o template "${template.name}"${input.isPublic ? " (público)" : ""}`,
        resource: template.name,
        resourceId: template.id,
        metadata: { category: template.category, isPublic: template.isPublic },
      });
    }

    return { template };
  });
