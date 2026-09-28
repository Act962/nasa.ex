import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findTagInOrg } from "../lib/workspace-access";

export const updateTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ tagId: z.string(), name: z.string().optional(), color: z.string().optional() }))
  .handler(async ({ input, context, errors }) => {
    const { tagId, ...data } = input;

    const existing = await findTagInOrg(tagId, context.org.id);
    if (!existing) throw errors.NOT_FOUND({ message: "Tag não encontrada" });

    const tag = await prisma.workspaceTag.update({ where: { id: tagId }, data });
    return { tag };
  });
