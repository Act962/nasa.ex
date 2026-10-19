import "server-only";
import prisma from "@/lib/prisma";
import { extractOriginCode, originCodeOf } from "./origin-code";
import { recordLeadOrigin, type LeadOriginDetails } from "./record-lead-origin";

// Lead novo pelo WhatsApp (spec 0114, RF-4): anúncio da Meta > código da página na mensagem > clique único de
// WhatsApp nas páginas da empresa nos últimos 15 min ("provável") > WhatsApp direto. Só roda na criação do lead.

const CODE_LINK_WINDOW_MS = 30 * 60_000;
const CLICK_MATCH_WINDOW_MS = 15 * 60_000;
const WHATSAPP_CLICK_SCAN_KINDS = ["qr_button", "whatsapp_link"];
const WHATSAPP_CLICK_VISIT_PATH = "_evt:whatsapp_click";
const MAX_RECENT_CLICKS = 10;

interface WhatsappOriginInput {
  leadId: string;
  organizationId: string;
  firstMessageText: string | null | undefined;
  /** Lead chegou por anúncio de clique para o WhatsApp (referência da Meta). */
  metaAd?: { headline?: string | null; adId?: string | null } | null;
  /** A equipe abriu a conversa pelo celular (eco `fromMe`): não é visitante de página nenhuma. */
  isOpenedByCompany?: boolean;
}

/**
 * Menor id gerado a partir de `since`. O id dos cliques é cuid v1 (`c` + data em base 36), então a janela de
 * tempo vira um intervalo da chave primária, sem varrer todas as visitas da página (não há índice por data).
 */
function minimumIdSince(since: Date): string {
  return `c${since.getTime().toString(36)}`;
}

function recentWindow(windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  return { id: { gte: minimumIdSince(since) }, createdAt: { gte: since } };
}

/** Liga ao lead o clique de WhatsApp mais recente da página que ainda não tem lead (o código já disse a página). */
async function linkLatestLinnkerClick(pageId: string, leadId: string): Promise<void> {
  const click = await prisma.linnkerScan.findFirst({
    where: { pageId, leadId: null, scanKind: { in: WHATSAPP_CLICK_SCAN_KINDS }, ...recentWindow(CODE_LINK_WINDOW_MS) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (click) await prisma.linnkerScan.update({ where: { id: click.id }, data: { leadId } });
}

async function originFromCode(input: WhatsappOriginInput): Promise<LeadOriginDetails | null> {
  const originCode = extractOriginCode(input.firstMessageText);
  if (!originCode) return null;
  if (originCode.product === "linnker") {
    const pages = await prisma.linnkerPage.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, title: true },
    });
    const matchingPages = pages.filter((candidate) => originCodeOf("linnker", candidate.id) === originCode.code);
    // Colisão de código (D-1): não chuta; cai na regra do horário.
    if (matchingPages.length !== 1) return null;
    const [page] = matchingPages;
    await linkLatestLinnkerClick(page.id, input.leadId).catch((error: unknown) =>
      console.warn("[lead-origin] ligar o clique do Linnker falhou", error),
    );
    return { origin: "LINNKER", sourceName: page.title, sourceId: page.id, channel: "WHATSAPP", matchedBy: "code", confidence: "certain" };
  }
  const sitePages = await prisma.nasaPage.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, title: true },
  });
  const matchingSitePages = sitePages.filter((candidate) => originCodeOf("pages", candidate.id) === originCode.code);
  if (matchingSitePages.length !== 1) return null;
  const [sitePage] = matchingSitePages;
  return { origin: "PAGES", sourceName: sitePage.title, sourceId: sitePage.id, channel: "WHATSAPP", matchedBy: "code", confidence: "certain" };
}

/**
 * Clique de WhatsApp no site já usado por outro lead novo depois dele. A visita do site não guarda o lead (o
 * Linnker guarda e sai da busca); sem esta conferência, um clique rotularia todos os leads da janela.
 */
async function isSiteClickAlreadyUsed(pageId: string, clickedAt: Date): Promise<boolean> {
  const usedBy = await prisma.leadJourneyEvent.findFirst({
    where: {
      kind: "lead_origin",
      // Intervalo da chave primária (cuid v1), como nos cliques: só os eventos gravados depois do clique.
      id: { gte: minimumIdSince(clickedAt) },
      occurredAt: { gte: clickedAt },
      AND: [
        { metadata: { path: ["sourceId"], equals: pageId } },
        { metadata: { path: ["matchedBy"], equals: "click_time" } },
      ],
    },
    select: { id: true },
  });
  return Boolean(usedBy);
}

/** Sem código: só liga quando uma única página teve clique de WhatsApp na janela; mais de uma seria chute. */
async function originFromRecentClick(input: WhatsappOriginInput): Promise<LeadOriginDetails | null> {
  const clickWindow = recentWindow(CLICK_MATCH_WINDOW_MS);
  const [linnkerClicks, siteClicks] = await Promise.all([
    prisma.linnkerScan.findMany({
      where: {
        page: { organizationId: input.organizationId },
        scanKind: { in: WHATSAPP_CLICK_SCAN_KINDS },
        leadId: null,
        ...clickWindow,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_CLICKS,
      select: { id: true, pageId: true, page: { select: { title: true } } },
    }),
    prisma.nasaPageVisit.findMany({
      where: {
        page: { organizationId: input.organizationId },
        path: { startsWith: WHATSAPP_CLICK_VISIT_PATH },
        ...clickWindow,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_CLICKS,
      select: { pageId: true, createdAt: true, page: { select: { title: true } } },
    }),
  ]);

  const unusedSiteClicks = [];
  for (const siteClick of siteClicks) {
    if (!(await isSiteClickAlreadyUsed(siteClick.pageId, siteClick.createdAt))) unusedSiteClicks.push(siteClick);
  }
  const clickedPageIds = new Set([...linnkerClicks.map((click) => click.pageId), ...unusedSiteClicks.map((click) => click.pageId)]);
  if (clickedPageIds.size !== 1) return null;

  const [linnkerClick] = linnkerClicks;
  if (linnkerClick) {
    // Liga exatamente o clique encontrado: ele sai da busca do próximo lead.
    await prisma.linnkerScan
      .update({ where: { id: linnkerClick.id }, data: { leadId: input.leadId } })
      .catch((error: unknown) => console.warn("[lead-origin] ligar o clique do Linnker falhou", error));
    return {
      origin: "LINNKER",
      sourceName: linnkerClick.page.title,
      sourceId: linnkerClick.pageId,
      channel: "WHATSAPP",
      matchedBy: "click_time",
      confidence: "probable",
    };
  }
  const [siteClick] = unusedSiteClicks;
  return {
    origin: "PAGES",
    sourceName: siteClick.page.title,
    sourceId: siteClick.pageId,
    channel: "WHATSAPP",
    matchedBy: "click_time",
    confidence: "probable",
  };
}

export async function recordWhatsappLeadOrigin(input: WhatsappOriginInput): Promise<void> {
  try {
    if (input.isOpenedByCompany) {
      await recordLeadOrigin(input.leadId, {
        origin: "MANUAL",
        channel: "WHATSAPP",
        matchedBy: "entry",
        confidence: "certain",
        note: "conversa iniciada pela equipe",
      });
      return;
    }
    if (input.metaAd) {
      await recordLeadOrigin(input.leadId, {
        origin: "META_ADS",
        sourceName: input.metaAd.headline ?? null,
        sourceId: input.metaAd.adId ?? null,
        channel: "WHATSAPP",
        matchedBy: "meta_ad",
        confidence: "certain",
      });
      return;
    }
    const details = (await originFromCode(input)) ??
      (await originFromRecentClick(input)) ?? {
        origin: "WHATSAPP" as const,
        matchedBy: "entry" as const,
        confidence: "certain" as const,
      };
    await recordLeadOrigin(input.leadId, details);
  } catch (error) {
    console.warn("[lead-origin] origem do WhatsApp falhou", error);
  }
}
