import prisma from "@/lib/prisma";

/**
 * Helpers paralelos ao `getMetaAuth` pra acessar Pages e Instagram Business
 * Accounts conectados na integração Meta da org.
 *
 * `getMetaAuth` resolve ad account + access token pra Marketing API (ads).
 * Aqui resolvemos Page Access Token + IG User ID pra Pages Insights API e
 * Instagram Graph API (que são endpoints diferentes).
 */

export interface FbPageEntry {
  id: string;
  name?: string;
  access_token: string;
  category?: string | null;
  instagram_business_account?: { id: string };
}

export interface FbIgEntry {
  id: string;
  username?: string;
  name?: string;
  page_id: string;
}

export interface MetaPageContext {
  /** Page selecionada (primeira de `selectedPageIds`, fallback pra `pages[0]`). */
  page: { id: string; name: string | null; accessToken: string } | null;
  /** IG Business ligado à page selecionada, se houver. */
  igAccount: { id: string; username: string | null } | null;
}

/**
 * Resolve a Page ativa (com seu access_token) e o IG Business associado.
 * Retorna `null` em `page` quando a integração não está conectada ou não
 * tem páginas selecionadas/disponíveis.
 */
export async function getMetaPageContext(
  orgId: string,
  opts?: { pageIdOverride?: string },
): Promise<MetaPageContext> {
  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: { organizationId: orgId, platform: "META" },
    },
  });
  if (!integration || !integration.isActive) {
    return { page: null, igAccount: null };
  }

  const config = (integration.config ?? {}) as Record<string, unknown>;
  const pages = (config.pages as FbPageEntry[] | undefined) ?? [];
  const selectedPageIds =
    (config.selectedPageIds as string[] | undefined) ?? [];
  const igAccounts = (config.igAccounts as FbIgEntry[] | undefined) ?? [];

  // 1. Override explícito (UI switcher), depois selecionada persistida, depois fallback.
  const wantedPageId =
    opts?.pageIdOverride ??
    selectedPageIds[0] ??
    pages[0]?.id ??
    null;

  const page = wantedPageId
    ? pages.find((p) => p.id === wantedPageId) ?? null
    : null;

  if (!page) {
    return { page: null, igAccount: null };
  }

  // 2. IG ligado à essa page específica (uma IG account por page).
  const ig =
    igAccounts.find((i) => i.page_id === page.id) ??
    (page.instagram_business_account?.id
      ? {
          id: page.instagram_business_account.id,
          username: undefined,
          name: undefined,
          page_id: page.id,
        }
      : null);

  return {
    page: {
      id: page.id,
      name: page.name ?? null,
      accessToken: page.access_token,
    },
    igAccount: ig
      ? { id: ig.id, username: ig.username ?? null }
      : null,
  };
}
