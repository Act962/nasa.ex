import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ALL_APPS } from "@/features/permissions/lib/app-permission-catalog";

const APP_KEYS = new Set(ALL_APPS.map((app) => app.key));

const appPermissionsShape = z.object({
  appKey: z.string(),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canApprove: z.boolean().default(false),
  canPay: z.boolean().default(false),
});

/**
 * Grava as exceções de permissão de UMA pessoa (spec 0152). Substitui todas as dela nesta org:
 * app que não vier na lista volta a seguir o papel. Só o Master altera, e nunca de outro Master.
 */
export const setMemberPermissions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Set per-user app permission overrides", tags: ["Permissions"] })
  .input(z.object({ userId: z.string(), overrides: z.array(appPermissionsShape).max(ALL_APPS.length) }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const [caller, target] = await Promise.all([
      prisma.member.findFirst({ where: { organizationId, userId: context.user.id }, select: { role: true } }),
      prisma.member.findFirst({ where: { organizationId, userId: input.userId }, select: { role: true } }),
    ]);
    if (caller?.role !== "owner") throw errors.FORBIDDEN({ message: "Apenas o Master pode alterar permissões." });
    if (!target) throw errors.NOT_FOUND({ message: "Usuário não encontrado nesta empresa." });
    if (target.role === "owner") throw errors.BAD_REQUEST({ message: "O Master sempre tem acesso a tudo." });
    if (input.overrides.some((override) => !APP_KEYS.has(override.appKey))) {
      throw errors.BAD_REQUEST({ message: "App desconhecido." });
    }

    await prisma.$transaction([
      prisma.memberAppPermission.deleteMany({ where: { organizationId, userId: input.userId } }),
      prisma.memberAppPermission.createMany({
        data: input.overrides.map((override) => ({ organizationId, userId: input.userId, ...override })),
      }),
    ]);

    await prisma.orgActivityLog.create({
      data: {
        organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "permission_member_updated",
        resource: input.userId,
        metadata: { overrides: input.overrides },
      },
    });

    return { success: true as const };
  });
