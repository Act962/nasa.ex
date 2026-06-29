import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const adminUpdateMember = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update member role/cargo/name", tags: ["Admin"] })
  .input(z.object({
    memberId: z.string(),
    role:     z.enum(["owner", "admin", "member", "moderador"]).optional(),
    cargo:    z.string().nullable().optional(),
    name:     z.string().min(1).optional(),
    nickname: z.string().nullable().optional(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const member = await prisma.member.findUnique({ where: { id: input.memberId }, select: { id: true, userId: true } });
    if (!member) throw errors.NOT_FOUND;

    if (input.role !== undefined || input.cargo !== undefined) {
      await prisma.member.update({
        where: { id: input.memberId },
        data: {
          ...(input.role  !== undefined ? { role: input.role }   : {}),
          ...(input.cargo !== undefined ? { cargo: input.cargo } : {}),
        },
      });
    }
    if (input.name !== undefined || input.nickname !== undefined) {
      await prisma.user.update({
        where: { id: member.userId },
        data: {
          ...(input.name     !== undefined ? { name: input.name }         : {}),
          ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        },
      });
    }
    return { success: true };
  });
