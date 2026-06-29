import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { POSITION_SLUGS } from "@/features/company/constants";

const MANAGER_ROLES = ["owner", "admin"];

export const updateMemberCargo = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      memberId: z.string(),
      cargo: z
        .string()
        .nullable()
        .refine((v) => v === null || POSITION_SLUGS.includes(v), {
          message: "Cargo inválido",
        }),
    }),
  )
  .handler(async ({ input, context }) => {
    const target = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true, userId: true },
    });
    if (!target) {
      throw new ORPCError("NOT_FOUND", { message: "Membro não encontrado" });
    }

    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });

    const isManager = !!actor && MANAGER_ROLES.includes(actor.role);
    const isSelf = target.userId === context.user.id;

    if (!isManager && !isSelf) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/admin podem editar o cargo de outros membros",
      });
    }

    const updated = await prisma.member.update({
      where: { id: input.memberId },
      data: { cargo: input.cargo },
      select: { id: true, cargo: true },
    });
    return { member: updated };
  });
