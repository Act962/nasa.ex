import "server-only";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import {
  isPaymentActionAllowed,
  resolvePaymentPermissions,
} from "@/features/payment/server/access/resolve-payment-permissions";
import type { PaymentAccessActor } from "@/features/payment/server/ensure-payment-access";
import type { AstroBriefingApp } from "@/features/astro/lib/astro-briefing-apps";

/**
 * Quem pode ver o resumo de cada App: a mesma régua da tela do App (spec 0056, RF-10).
 * Matriz de Permissões para os Apps comuns; whitelist do financeiro (PaymentAccess) para Financeiro e Contábil.
 * `null` = o resumo já é do próprio usuário (trilhas) ou o App não tem chave na matriz e a tela também não restringe.
 */

type BriefingAccessRule = { kind: "app"; appKey: string } | { kind: "payment" } | null;

const BRIEFING_ACCESS_RULES: Record<AstroBriefingApp, BriefingAccessRule> = {
  forms: { kind: "app", appKey: "formularios" },
  tracking: { kind: "app", appKey: "tracking" },
  chat: { kind: "app", appKey: "chat" },
  agenda: { kind: "app", appKey: "spacetime" },
  workspace: { kind: "app", appKey: "workspace" },
  forge: { kind: "app", appKey: "forge" },
  campanhas: null,
  contacts: { kind: "app", appKey: "contatos" },
  pages: { kind: "app", appKey: "nasa-pages" },
  linnker: { kind: "app", appKey: "linnker" },
  nbox: { kind: "app", appKey: "nbox" },
  insights: { kind: "app", appKey: "insights" },
  planner: { kind: "app", appKey: "nasa-planner" },
  route: { kind: "app", appKey: "nasa-route" },
  trafego: null,
  integrations: { kind: "app", appKey: "integrations" },
  starFriends: { kind: "app", appKey: "star-friends" },
  spaceStation: { kind: "app", appKey: "space-station" },
  spaceHelp: null,
  finance: { kind: "payment" },
  accounting: { kind: "payment" },
};

const RESTRICTED_DATA_LABELS: Record<AstroBriefingApp, string> = {
  forms: "dos Formulários",
  tracking: "do Tracking",
  chat: "do Chat",
  agenda: "da Agenda",
  workspace: "do Workspace",
  forge: "do Forge",
  campanhas: "das Campanhas",
  contacts: "dos Contatos",
  pages: "do Pages",
  linnker: "do Linnker",
  nbox: "do N-Box",
  insights: "dos Insights",
  planner: "do Planner",
  route: "do Route",
  trafego: "do trafeGO",
  integrations: "dos Satélites",
  starFriends: "do STAR FRIENDS",
  spaceStation: "da Space Station",
  spaceHelp: "do Space Help",
  finance: "do financeiro",
  accounting: "da aba Contábil",
};

export async function canViewAppBriefing(
  app: AstroBriefingApp,
  organizationId: string,
  actor: PaymentAccessActor,
): Promise<boolean> {
  const rule = BRIEFING_ACCESS_RULES[app];
  if (!rule) return true;
  if (rule.kind === "payment") {
    const paymentPermissions = await resolvePaymentPermissions(actor, organizationId);
    return isPaymentActionAllowed(paymentPermissions, "dashboard", "view");
  }
  return hasAppPermission(organizationId, actor.id, rule.appKey, "canView");
}

export function buildRestrictedBriefingMessage(app: AstroBriefingApp, firstName: string) {
  const howToGetAccess =
    BRIEFING_ACCESS_RULES[app]?.kind === "payment"
      ? "Peça a um administrador do financeiro para liberar o seu acesso."
      : "Peça ao Master para liberar em Configurações → Permissões.";
  return `${firstName}, você não tem acesso aos dados ${RESTRICTED_DATA_LABELS[app]}. ${howToGetAccess}`;
}
