import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { heartbeatIntervalSeconds: true },
    });
    return { heartbeatIntervalSeconds: org?.heartbeatIntervalSeconds ?? 60 };
  });
