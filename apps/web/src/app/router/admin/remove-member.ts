import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const adminRemoveMember = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Remove member from org", tags: ["Admin"] })
  .input(z.object({ memberId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const member = await prisma.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw errors.NOT_FOUND;
    await prisma.member.delete({ where: { id: input.memberId } });
    return { success: true };
  });
