import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "crypto";
import { z } from "zod";
import { enqueueMemberSync } from "@/features/sync/lib/emit";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12)).map((b) => chars[b % chars.length]).join("");
}

export const adminCreateOrgUser = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Create user and add to org", tags: ["Admin"] })
  .input(z.object({
    orgId:    z.string(),
    name:     z.string().min(2),
    email:    z.string().email(),
    role:     z.enum(["owner", "admin", "member", "moderador"]).default("member"),
    cargo:    z.string().optional(),
  }))
  .output(z.object({
    userId:      z.string(),
    memberId:    z.string(),
    isNewUser:   z.boolean(),
    tempPassword: z.string().nullable(),
  }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({ where: { id: input.orgId }, select: { id: true } });
    if (!org) throw errors.NOT_FOUND;

    const emailLower = input.email.toLowerCase().trim();

    // Check already member
    const existingMember = await prisma.member.findFirst({
      where: { organizationId: input.orgId, user: { email: emailLower } },
    });
    if (existingMember) throw errors.BAD_REQUEST;

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    let userId: string;
    let isNewUser = false;

    const existingUser = await prisma.user.findFirst({ where: { email: emailLower } });

    if (existingUser) {
      userId = existingUser.id;
    } else {
      isNewUser = true;
      const { createId } = await import("@paralleldrive/cuid2");
      const newUserId = createId();
      await prisma.user.create({
        data: { id: newUserId, name: input.name, email: emailLower, emailVerified: false, createdAt: new Date(), updatedAt: new Date() },
      });
      await prisma.account.create({
        data: { id: createId(), accountId: newUserId, providerId: "credential", userId: newUserId, password: hashedPassword, createdAt: new Date(), updatedAt: new Date() },
      });
      userId = newUserId;
    }

    const { createId: cid } = await import("@paralleldrive/cuid2");
    const member = await prisma.member.create({
      data: { id: cid(), organizationId: input.orgId, userId, role: input.role, cargo: input.cargo ?? null, createdAt: new Date() },
    });

    // Replica o membro (e User/Account/Org junto) pro NERP — best-effort.
    await enqueueMemberSync(member.id);

    return { userId, memberId: member.id, isNewUser, tempPassword: isNewUser ? tempPassword : null };
  });
