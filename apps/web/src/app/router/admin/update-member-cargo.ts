import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateMemberCargo = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update member cargo", tags: ["Admin"] })
  .input(z.object({
    memberId: z.string(),
    cargo:    z.string().max(100).nullable(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const member = await prisma.member.findUnique({
      where: { id: input.memberId },
      select: { id: true },
    });
    if (!member) throw errors.NOT_FOUND;

    await prisma.member.update({
      where: { id: input.memberId },
      data: { cargo: input.cargo },
    });

    return { success: true };
  });
