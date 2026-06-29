import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const VALID_ROLES = ["owner", "admin", "member", "moderador"] as const;

export const adminUpdateMemberRole = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update member role", tags: ["Admin"] })
  .input(z.object({
    memberId: z.string(),
    role: z.enum(VALID_ROLES),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findUnique({
      where: { id: input.memberId },
      select: { id: true, role: true, organizationId: true, userId: true, user: { select: { email: true } } },
    });
    if (!member) throw errors.NOT_FOUND;

    await prisma.member.update({
      where: { id: input.memberId },
      data: { role: input.role },
    });

    return { success: true };
  });
