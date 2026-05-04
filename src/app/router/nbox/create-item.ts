import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NBoxItemType } from "@/generated/prisma/enums";

export const createItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    folderId: z.string().nullable().optional(),
    type: z.nativeEnum(NBoxItemType),
    name: z.string().min(1).max(255),
    url: z.string().optional(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    forgeContractId: z.string().optional(),
    forgeProposalId: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const item = await prisma.nBoxItem.create({
      data: {
        organizationId: context.org.id,
        folderId: input.folderId ?? null,
        type: input.type,
        name: input.name,
        url: input.url ?? null,
        mimeType: input.mimeType ?? null,
        size: input.size ?? null,
        description: input.description ?? null,
        tags: input.tags ?? [],
        forgeContractId: input.forgeContractId ?? null,
        forgeProposalId: input.forgeProposalId ?? null,
        createdById: context.user.id,
      },
      include: { createdBy: { select: { id: true, name: true, image: true } } },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      subAppSlug: "nbox-items",
      featureKey: input.type === NBoxItemType.FILE ? "nbox.file.uploaded" : "nbox.link.added",
      action: "nbox.item.created",
      actionLabel: `Adicionou o ${input.type === NBoxItemType.FILE ? "arquivo" : "link"} "${item.name}" no NBox`,
      resource: item.name,
      resourceId: item.id,
      metadata: { type: item.type, hasFolder: !!input.folderId, size: item.size },
    });

    return { item };
  });
