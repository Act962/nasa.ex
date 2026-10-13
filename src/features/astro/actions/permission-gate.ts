import "server-only";
import { assertPaymentToolAccess } from "@/features/astro/server/tools/finance/access";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  isOrgActionAllowed,
  resolveOrgPermissions,
  type ResolvedOrgPermissions,
} from "@/features/permissions/server/resolve-org-permissions";
import type { AppKey, OrgAction } from "@/features/permissions/lib/catalog";
import { astroDenialFor } from "@/features/astro/lib/permission-denial";

/**
 * Gate de permissão do Astro, no mesmo desenho do gate financeiro
 * (`tools/finance/access.ts`): resolve uma vez por request e cacheia no ctx.
 *
 * A régua é paridade — o Astro é um caminho a mais, não um atalho. Ele não
 * pode liberar o que a tela nega nem negar o que a tela libera, porque lê a
 * mesma matriz que o Master configurou.
 */

type AccessCache = WeakMap<AgentContext, Promise<ResolvedOrgPermissions | null>>;
const accessCache: AccessCache = new WeakMap();

function loadPermissions(ctx: AgentContext) {
  let cached = accessCache.get(ctx);
  if (!cached) {
    cached = resolveOrgPermissions(ctx.userId, ctx.organizationId);
    accessCache.set(ctx, cached);
  }
  return cached;
}

/** Rastro da recusa, sem o conteúdo pedido (spec 0082, RF-11). */
function logDenial(ctx: AgentContext, appKey: AppKey, action: OrgAction) {
  console.warn(
    `[ASTRO/permission] negado user=${ctx.userId} org=${ctx.organizationId} ` +
      `canal=${ctx.channel ?? "CHAT"} app=${appKey} acao=${action}`,
  );
}

export type PermissionCheck = { ok: true } | { ok: false; error: string };

export async function checkAstroPermission(params: {
  ctx: AgentContext;
  appKey: AppKey;
  action: OrgAction;
}): Promise<PermissionCheck> {
  const resolved = await loadPermissions(params.ctx);

  if (!resolved) {
    logDenial(params.ctx, params.appKey, params.action);
    return { ok: false, error: astroDenialFor(params.action) };
  }

  if (isOrgActionAllowed(resolved, params.appKey, params.action)) {
    // O Financeiro tem acesso próprio além da matriz: sem ele, recusa antes
    // de perguntar qualquer dado do lançamento (F7-01).
    if (params.appKey === "financeiro") {
      return assertPaymentToolAccess(params.ctx, "entries", params.action);
    }
    return { ok: true };
  }

  logDenial(params.ctx, params.appKey, params.action);
  return { ok: false, error: astroDenialFor(params.action) };
}

/** Versão booleana, para filtrar consultas e ferramentas sem montar a recusa. */
export async function canAstroDo(
  ctx: AgentContext,
  appKey: AppKey,
  action: OrgAction,
): Promise<boolean> {
  return isOrgActionAllowed(await loadPermissions(ctx), appKey, action);
}

export async function canAstroRead(
  ctx: AgentContext,
  appKey: AppKey,
): Promise<boolean> {
  return canAstroDo(ctx, appKey, "view");
}
