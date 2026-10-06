/** Resolução de sites por domínio próprio (server-side). */
import { promises as dns } from "node:dns";
import prisma from "@/lib/prisma";
import { customDomainCandidates } from "../lib/edge-headers";

export interface PagesEdgeConfig {
  /** Destino do CNAME `www` (ex.: pages.nasaex.com). */
  edgeHost: string | null;
  /** Destino do registro A do domínio sem `www`. */
  edgeIp: string | null;
}

export function getPagesEdgeConfig(): PagesEdgeConfig {
  return {
    edgeHost: process.env.PAGES_EDGE_HOST?.trim().toLowerCase() || null,
    edgeIp: process.env.PAGES_EDGE_IP?.trim() || null,
  };
}

const SITE_PAGE_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  publishedLayout: true,
  palette: true,
  fontFamily: true,
  faviconUrl: true,
  ogImageUrl: true,
} as const;

/** A portaria só emite certificado para domínio verificado e ligado a um site. */
export async function isCustomDomainVerified(host: string): Promise<boolean> {
  const verifiedPage = await prisma.nasaPage.findFirst({
    where: { customDomain: { in: customDomainCandidates(host) }, domainStatus: "VERIFIED" },
    select: { id: true },
  });
  return verifiedPage !== null;
}

/**
 * Acha o site publicado de um domínio verificado. `pathSegments` vazio = página inicial;
 * um segmento = subpágina publicada. Qualquer outra coisa não resolve.
 */
export async function resolveCustomDomainSite(host: string, pathSegments: string[]) {
  if (pathSegments.length > 1) return null;
  const [subpageSlug] = pathSegments;

  // O domínio pode estar numa página que deixou de ser a inicial ("definir como home" troca
  // a raiz sem mexer no domínio): o site é sempre o da raiz atual de quem tem o domínio.
  const domainOwnerPage = await prisma.nasaPage.findFirst({
    where: { customDomain: { in: customDomainCandidates(host) }, domainStatus: "VERIFIED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, parentPageId: true },
  });
  if (!domainOwnerPage) return null;

  const rootPage = await prisma.nasaPage.findFirst({
    where: {
      id: domainOwnerPage.parentPageId ?? domainOwnerPage.id,
      status: "PUBLISHED",
      parentPageId: null,
    },
    select: {
      ...SITE_PAGE_SELECT,
      organization: { select: { slug: true } },
      subpages: {
        where: { status: "PUBLISHED" },
        orderBy: [{ subpageOrder: "asc" }, { createdAt: "asc" }],
        select: SITE_PAGE_SELECT,
      },
    },
  });
  if (!rootPage) return null;

  const targetPage = subpageSlug
    ? rootPage.subpages.find((subpage) => subpage.slug === subpageSlug)
    : rootPage;
  if (!targetPage?.publishedLayout) return null;

  return {
    page: targetPage,
    rootSlug: rootPage.slug,
    organizationSlug: rootPage.organization?.slug ?? null,
    siblingPages: [
      { id: rootPage.id, slug: rootPage.slug, title: rootPage.title, isRoot: true },
      ...rootPage.subpages.map((subpage) => ({
        id: subpage.id,
        slug: subpage.slug,
        title: subpage.title,
        isRoot: false,
      })),
    ],
  };
}

async function resolvesToEdge(hostname: string, edgeConfig: PagesEdgeConfig): Promise<boolean> {
  const { edgeHost, edgeIp } = edgeConfig;
  if (edgeHost) {
    const cnameTargets = await dns.resolveCname(hostname).catch(() => [] as string[]);
    if (cnameTargets.some((target) => target.toLowerCase().replace(/\.$/, "") === edgeHost)) return true;
  }
  if (edgeIp) {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    if (addresses.includes(edgeIp)) return true;
  }
  return false;
}

/**
 * O domínio (com ou sem `www`) já aponta para a portaria? Sem portaria configurada no
 * ambiente não há o que conferir, e a verificação fica só no TXT, como era antes.
 */
export async function isDomainPointingToEdge(domain: string): Promise<boolean> {
  const edgeConfig = getPagesEdgeConfig();
  if (!edgeConfig.edgeHost && !edgeConfig.edgeIp) return true;
  const pointingChecks = await Promise.all(
    customDomainCandidates(domain).map((hostname) => resolvesToEdge(hostname, edgeConfig)),
  );
  return pointingChecks.some(Boolean);
}
