import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(18).toString("base64url");
}

export const createInviteLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      role: z.enum(["admin", "member", "moderador"]).default("member"),
      durationDays: z.number().int().positive().max(365 * 10),
      starsOnJoin: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || !["owner", "admin", "moderador"].includes(currentMember.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para criar links de convite" });
    }

    if (input.role === "moderador" && currentMember.role !== "owner") {
      throw new ORPCError("FORBIDDEN", { message: "Apenas o Master pode criar links com role moderador" });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.durationDays);

    const inviteLink = await prisma.organizationInviteLink.create({
      data: {
        organizationId: orgId,
        token: generateToken(),
        role: input.role,
        expiresAt,
        createdById: context.user.id,
        starsOnJoin: input.starsOnJoin,
      },
    });

    await prisma.orgActivityLog.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "invite_link_created",
        resource: inviteLink.id,
        resourceId: inviteLink.id,
        metadata: { role: input.role, durationDays: input.durationDays, starsOnJoin: input.starsOnJoin },
      },
    });

    return inviteLink;
  });
