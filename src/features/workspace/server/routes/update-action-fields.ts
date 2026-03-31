import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateActionFields = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    actionId: z.string(),
    attachments: z.array(z.record(z.string(), z.any())).optional(),
    links: z.array(z.record(z.string(), z.any())).optional(),
    youtubeUrl: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    isArchived: z.boolean().optional(),
    isFavorited: z.boolean().optional(),
  }))
  .handler(async ({ input, context }) => {
    const { actionId, ...data } = input;
    const existing = await prisma.action.findUnique({ where: { id: actionId }, select: { history: true } });
    const history = (existing?.history as any[]) ?? [];
    const newEntry = {
      type: "update",
      userId: context.user.id,
      timestamp: new Date().toISOString(),
      changes: Object.keys(data).filter(k => (data as any)[k] !== undefined),
    };
    const action = await prisma.action.update({
      where: { id: actionId },
      data: { ...data, history: [...history, newEntry] },
    });
    return { action };
  });
