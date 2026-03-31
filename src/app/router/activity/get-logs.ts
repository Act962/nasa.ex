import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const getLogs = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    userId:    z.string().optional(),
    appSlug:   z.string().optional(),
    startDate: z.string().optional(), // ISO string
    endDate:   z.string().optional(),
    limit:     z.number().default(100),
    offset:    z.number().default(0),
  }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    // Only master, admin, moderador can view
    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || currentMember.role === "member") {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para ver o histórico" });
    }

    const where: any = { organizationId: orgId };
    if (input.userId) where.userId = input.userId;
    if (input.appSlug) where.appSlug = input.appSlug;
    if (input.startDate || input.endDate) {
      where.createdAt = {};
      if (input.startDate) where.createdAt.gte = new Date(input.startDate);
      if (input.endDate)   where.createdAt.lte = new Date(input.endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.systemActivityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
      }),
      prisma.systemActivityLog.count({ where }),
    ]);

    // Also get org permission logs (legacy) if no specific user/app filter that excludes them
    const orgLogs = !input.appSlug || input.appSlug === "permissions"
      ? await prisma.orgActivityLog.findMany({
          where: {
            organizationId: orgId,
            ...(input.userId ? { userId: input.userId } : {}),
            ...(input.startDate || input.endDate ? {
              createdAt: {
                ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
                ...(input.endDate ? { lte: new Date(input.endDate) } : {}),
              }
            } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    // Normalize OrgActivityLog to same shape
    const normalizedOrgLogs = orgLogs.map((l) => ({
      id: l.id,
      organizationId: l.organizationId,
      userId: l.userId,
      userName: l.userName,
      userEmail: l.userEmail,
      userImage: null as string | null,
      appSlug: "permissions",
      action: l.action,
      actionLabel: formatOrgAction(l.action, l.resource),
      resource: l.resource,
      resourceId: l.resourceId,
      metadata: l.metadata,
      createdAt: l.createdAt,
    }));

    // Merge and sort
    const merged = [...logs.map((l) => ({ ...l, userImage: l.userImage ?? null })), ...normalizedOrgLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, input.limit);

    return { logs: merged, total: total + orgLogs.length };
  });

function formatOrgAction(action: string, resource?: string | null): string {
  const map: Record<string, string> = {
    member_added:        `Adicionou membro ${resource ?? ""}`,
    member_removed:      `Removeu membro ${resource ?? ""}`,
    role_changed:        `Alterou cargo de ${resource ?? ""}`,
    permission_updated:  `Atualizou permissão: ${resource ?? ""}`,
  };
  return map[action] ?? action;
}
