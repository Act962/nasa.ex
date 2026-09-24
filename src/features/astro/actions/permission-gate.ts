import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  isOrgActionAllowed,
  listPermissionGrantersNames,
  resolveOrgPermissions,
  type ResolvedOrgPermissions,
} from "@/features/permissions/server/resolve-org-permissions";
import { appLabel, type AppKey, type OrgAction } from "@/features/permissions/lib/catalog";

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

const ACTION_VERB: Record<OrgAction, string> = {
  view: "ver",
  create: "criar em",
  edit: "editar em",
  delete: "excluir em",
};

/** Recusa útil: diz o que faltou e a quem pedir (decisão do dono do produto). */
async function buildDenial(
  ctx: AgentContext,
  appKey: AppKey,
  action: OrgAction,
): Promise<string> {
  const granters = await listPermissionGrantersNames(ctx.organizationId);
  const who =
    granters.length === 0
      ? "o Master da organização"
      : granters.length === 1
        ? granters[0]
        : `${granters.slice(0, -1).join(", ")} ou ${granters[granters.length - 1]}`;
  return (
    `Você não tem permissão para ${ACTION_VERB[action]} ${appLabel(appKey)}. ` +
    `Quem libera é ${who}, em Configurações › Permissões.`
  );
}

export type PermissionCheck = { ok: true } | { ok: false; error: string };

export async function checkAstroPermission(params: {
  ctx: AgentContext;
  appKey: AppKey;
  action: OrgAction;
}): Promise<PermissionCheck> {
  const resolved = await loadPermissions(params.ctx);

  // Não é membro da organização: nem chega a falar de app nenhum.
  if (!resolved) {
    return { ok: false, error: "Você não faz parte desta organização." };
  }

  if (isOrgActionAllowed(resolved, params.appKey, params.action)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: await buildDenial(params.ctx, params.appKey, params.action),
  };
}

/** Versão booleana, para filtrar consultas de leitura sem montar a recusa. */
export async function canAstroRead(
  ctx: AgentContext,
  appKey: AppKey,
): Promise<boolean> {
  return isOrgActionAllowed(await loadPermissions(ctx), appKey, "view");
}
