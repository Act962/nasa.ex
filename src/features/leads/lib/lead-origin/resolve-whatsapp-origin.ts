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
}

/** Liga a leitura mais recente da página, ainda sem lead, ao lead novo: ela aparece na Jornada dele. */
async function linkRecentLinnkerScan(pageId: string, leadId: string, sinceMs: number): Promise<void> {
  const scan = await prisma.linnkerScan.findFirst({
    where: { pageId, leadId: null, createdAt: { gte: new Date(Date.now() - sinceMs) } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (scan) await prisma.linnkerScan.update({ where: { id: scan.id }, data: { leadId } });
}

async function originFromCode(input: WhatsappOriginInput): Promise<LeadOriginDetails | null> {
  const originCode = extractOriginCode(input.firstMessageText);
  if (!originCode) return null;
  if (originCode.product === "linnker") {
    const pages = await prisma.linnkerPage.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, title: true },
    });
    const page = pages.find((candidate) => originCodeOf("linnker", candidate.id) === originCode.code);
    if (!page) return null;
    await linkRecentLinnkerScan(page.id, input.leadId, CODE_LINK_WINDOW_MS);
    return { origin: "LINNKER", sourceName: page.title, sourceId: page.id, channel: "WHATSAPP", matchedBy: "code", confidence: "certain" };
  }
  const sitePages = await prisma.nasaPage.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, title: true },
  });
  const sitePage = sitePages.find((candidate) => originCodeOf("pages", candidate.id) === originCode.code);
  if (!sitePage) return null;
  return { origin: "PAGES", sourceName: sitePage.title, sourceId: sitePage.id, channel: "WHATSAPP", matchedBy: "code", confidence: "certain" };
}

/** Sem código: só liga quando uma única página teve clique de WhatsApp na janela; mais de uma seria chute. */
async function originFromRecentClick(input: WhatsappOriginInput): Promise<LeadOriginDetails | null> {
  const since = new Date(Date.now() - CLICK_MATCH_WINDOW_MS);
  const [linnkerClicks, siteClicks] = await Promise.all([
    prisma.linnkerScan.findMany({
      where: {
        page: { organizationId: input.organizationId },
        scanKind: { in: WHATSAPP_CLICK_SCAN_KINDS },
        leadId: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_CLICKS,
      select: { pageId: true, page: { select: { title: true } } },
    }),
    prisma.nasaPageVisit.findMany({
      where: {
        page: { organizationId: input.organizationId },
        path: { startsWith: WHATSAPP_CLICK_VISIT_PATH },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_CLICKS,
      select: { pageId: true, page: { select: { title: true } } },
    }),
  ]);
  const clickedPageIds = new Set([...linnkerClicks.map((click) => click.pageId), ...siteClicks.map((click) => click.pageId)]);
  if (clickedPageIds.size !== 1) return null;
  const linnkerClick = linnkerClicks[0];
  if (linnkerClick) {
    await linkRecentLinnkerScan(linnkerClick.pageId, input.leadId, CLICK_MATCH_WINDOW_MS);
    return {
      origin: "LINNKER",
      sourceName: linnkerClick.page.title,
      sourceId: linnkerClick.pageId,
      channel: "WHATSAPP",
      matchedBy: "click_time",
      confidence: "probable",
    };
  }
  const siteClick = siteClicks[0];
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
