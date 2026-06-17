import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

// Apps available in NASA Explorer
export const ALL_APPS = [
  // Core
  { key: "tracking",              label: "Tracking / CRM",          icon: "🎯" },
  { key: "tracking-automacoes",   label: "Tracking (Automações)",   icon: "⚡" },
  { key: "contatos",              label: "Contatos",                icon: "👥" },
  { key: "formularios",           label: "Formulários",             icon: "📋" },
  // Comunicação
  { key: "chat",                  label: "Chat / Atendimento",      icon: "💬" },
  { key: "linnker",               label: "Linnker",                 icon: "🔗" },
  // Propostas & Contratos
  { key: "forge",                 label: "Forge / Propostas",       icon: "📄" },
  { key: "forge-contracts",       label: "Contratos",               icon: "✍️" },
  // Agenda & Planejamento
  { key: "spacetime",             label: "SpaceTime / Agenda",      icon: "📅" },
  { key: "nasa-planner",          label: "Planner",                 icon: "🗓️" },
  // Workspace
  { key: "workspace",             label: "Workspace",               icon: "🏢" },
  { key: "workspace-automacoes",  label: "Workspace (Automações)",  icon: "⚙️" },
  // Financeiro
  { key: "financeiro",            label: "Financeiro",              icon: "💰" },
  // Gamificação
  { key: "stars",                 label: "Stars",                   icon: "⭐" },
  { key: "space-points",          label: "Space Points",            icon: "🏅" },
  // Análise & Navegação
  { key: "insights",              label: "Insights",                icon: "📊" },
  { key: "insights-layout",       label: "Insights · Layout",       icon: "🧩" },
  { key: "nasa-route",            label: "NASA Route",              icon: "🗺️" },
  // Infra
  { key: "integrations",          label: "Integrações",             icon: "🔌" },
  { key: "explorer",              label: "NASA Explorer",           icon: "🚀" },
  { key: "nbox",                  label: "NBox",                    icon: "📦" },
];

export const NASA_ROLES = ["owner", "admin", "member", "moderador"] as const;
export type NasaRole = typeof NASA_ROLES[number];

export const ROLE_LABELS: Record<string, string> = {
  owner:     "Master",
  admin:     "Adm",
  member:    "Single",
  moderador: "Moderador",
};

export const ROLE_COLORS: Record<string, string> = {
  owner:     "violet",
  admin:     "blue",
  member:    "slate",
  moderador: "orange",
};

// Tipo das permissões — `canApprove` e `canPay` são opcionais e só
// interpretados quando `appKey ∈ APPS_WITH_EXTENDED_ACTIONS` (ex: financeiro).
export type AppPermissions = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPay: boolean;
};

// Default permissions per role. Owner/admin recebem canApprove/canPay True
// automaticamente (master pode revogar via UI); member/moderador precisam de
// override explícito em Settings → Permissões → Financeiro.
export const DEFAULT_PERMISSIONS: Record<string, AppPermissions> = {
  owner:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  canApprove: true,  canPay: true  },
  admin:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: true,  canPay: true  },
  member:    { canView: true,  canCreate: true,  canEdit: false, canDelete: false, canApprove: false, canPay: false },
  moderador: { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canPay: false },
};

// Apps com actions estendidas (`canApprove`, `canPay`). UI da matriz só
// renderiza essas colunas pra esses appKeys; pros demais, ignora silenciosamente.
export const APPS_WITH_EXTENDED_ACTIONS = new Set<string>(["financeiro"]);

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
