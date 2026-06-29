import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { requireModerator } from "../utils";

export const adminListCategories = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    await requireModerator(context.user.id);
    const categories = await prisma.spaceHelpCategory.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { features: true, tracks: true } },
      },
    });
    return { categories };
  });
