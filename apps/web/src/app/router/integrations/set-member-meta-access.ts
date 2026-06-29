import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { MetaAccountKind } from "@/generated/prisma/enums";
import { assertIsFullAccessMember } from "../meta-ads/_access";

function normalizeAdAccountId(raw: string): string {
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export const setMemberMetaAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      userId: z.string().min(1),
      kind: z.enum(["AD_ACCOUNT", "PAGE", "IG_ACCOUNT"]),
      accountKeys: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    await assertIsFullAccessMember(orgId, context.user.id);

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: input.userId },
      select: { id: true },
    });
    if (!member) {
      return { success: false, message: "Usuário não pertence a esta organização" };
    }

    const kind = input.kind as MetaAccountKind;
    const keys =
      kind === MetaAccountKind.AD_ACCOUNT
        ? input.accountKeys.map(normalizeAdAccountId)
        : input.accountKeys;

    await prisma.$transaction(async (tx) => {
      await tx.memberMetaAccountAccess.deleteMany({
        where: { organizationId: orgId, userId: input.userId, kind },
      });
      if (keys.length > 0) {
        await tx.memberMetaAccountAccess.createMany({
          data: keys.map((accountKey) => ({
            organizationId: orgId,
            userId: input.userId,
            kind,
            accountKey,
          })),
        });
      }
    });

    return { success: true, count: keys.length };
  });
