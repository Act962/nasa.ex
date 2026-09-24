import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

// O catálogo mora em src/features/permissions/lib/catalog.ts — a tela e o
// gate das ações do Astro leem a mesma matriz. Reexportado aqui para não
// quebrar quem já importava deste módulo.
export {
  ALL_APPS,
  NASA_ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  DEFAULT_PERMISSIONS,
  APPS_WITH_EXTENDED_ACTIONS,
  type NasaRole,
  type AppPermissions,
} from "@/features/permissions/lib/catalog";

import {
  ALL_APPS,
  DEFAULT_PERMISSIONS,
  NASA_ROLES,
  type AppPermissions,
} from "@/features/permissions/lib/catalog";

export const getPermissions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    // Get members with user info and stars consumed (from StarTransaction)
    const members = await prisma.member.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, image: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    });

    // (Removido) Antes buscávamos as últimas 200 starTransactions aqui pra
    // popular o card "Consumo de Stars" na aba Permissões. O card foi movido
    // pro popup "Histórico de consumo" do widget de Stars no header, que
    // chama `stars.listTransactions` direto.

    // Fetch existing permission overrides
    const dbPerms = await prisma.orgPermission.findMany({
      where: { organizationId: orgId },
    });

    // Build permission matrix: role → appKey → permissions
    // `canApprove`/`canPay` ficam no payload independente do app — o cliente
    // decide se renderiza/usa baseado em APPS_WITH_EXTENDED_ACTIONS.
    const matrix: Record<string, Record<string, AppPermissions>> = {};
    for (const role of NASA_ROLES) {
      matrix[role] = {};
      for (const app of ALL_APPS) {
        const override = dbPerms.find((p) => p.role === role && p.appKey === app.key);
        matrix[role][app.key] = override
          ? {
              canView:    override.canView,
              canCreate:  override.canCreate,
              canEdit:    override.canEdit,
              canDelete:  override.canDelete,
              canApprove: override.canApprove,
              canPay:     override.canPay,
            }
          : { ...DEFAULT_PERMISSIONS[role] };
      }
    }

    // Recent activity log
    const logs = await prisma.orgActivityLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        roleLabel: ROLE_LABELS[m.role] ?? m.role,
        createdAt: m.createdAt,
        user: m.user,
      })),
      apps: ALL_APPS,
      roles: NASA_ROLES,
      roleLabels: ROLE_LABELS,
      roleColors: ROLE_COLORS,
      matrix,
      // Sinaliza pra UI quais appKeys mostram as colunas extra (Aprovar/Pagar).
      // Hoje só "financeiro"; UI usa pra renderizar 6 colunas (vs 4 default).
      extendedActionApps: Array.from(APPS_WITH_EXTENDED_ACTIONS),
      starsBalance: (context.org as any).starsBalance ?? 0,
      logs: logs.map((l) => ({
        id: l.id,
        userId: l.userId,
        userName: l.userName,
        userEmail: l.userEmail,
        action: l.action,
        resource: l.resource,
        createdAt: l.createdAt,
        metadata: l.metadata,
      })),
    };
  });
