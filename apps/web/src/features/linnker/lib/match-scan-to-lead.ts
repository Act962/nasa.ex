/**
 * Correlaciona uma mensagem inbound do WhatsApp a um LinnkerScan
 * recente, pra poder aplicar tag "QR Linnker" e disparar resposta
 * automatizada no workflow.
 *
 * O problema: o QR redireciona pra `wa.me/<phone>?text=...` que abre
 * o app WhatsApp. Quando a pessoa envia, o tracking recebe inbound
 * — mas sem nenhum metadado que diga "veio do QR" (wa.me não permite
 * params invisíveis).
 *
 * A solução: na rota redirect, gravamos um `LinnkerScan` com
 * `userAgent` + `ipAddress` + UTM + timestamp. Depois, quando chega
 * o inbound, este helper procura scans recentes (≤ janela) com
 * mesmo phone OU mesmo UA pra fazer o match.
 *
 * Janela padrão: 24h. Antes disso é improvável que o scan seja a
 * mesma sessão (a pessoa pode escanear hoje e mandar mensagem
 * amanhã); depois disso, vira ruído estatístico.
 */

import prisma from "@/lib/prisma";

const DEFAULT_WINDOW_HOURS = 24;

export interface MatchScanArgs {
  /** Phone do lead inbound (formato livre — será normalizado). */
  phone: string;
  /** Slug da LinnkerPage do dono (filtra escopo). */
  pageSlug?: string;
  /** Janela de tempo em horas pra considerar o scan "recente". */
  windowHours?: number;
}

export interface ScanMatch {
  scanId: string;
  pageId: string;
  pageSlug: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  matchedBy: "phone" | "page_only";
  ageMinutes: number;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export async function matchScanToLead(
  args: MatchScanArgs,
): Promise<ScanMatch | null> {
  const phone = normalizePhone(args.phone);
  if (!phone) return null;

  const windowHours = args.windowHours ?? DEFAULT_WINDOW_HOURS;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Estratégia em 2 fases:
  // 1. Match exato por phone — mais forte.
  // 2. Se não achou + pageSlug fornecido, retorna scan mais recente
  //    da page (assumindo que único scan recente => mesma pessoa).
  //    Fraco mas útil quando user escaneia e manda mensagem rápido.

  const baseWhere = {
    createdAt: { gte: since },
    ...(args.pageSlug && {
      page: { slug: args.pageSlug },
    }),
  };

  // Fase 1: phone match
  const byPhone = await prisma.linnkerScan.findFirst({
    where: {
      ...baseWhere,
      phone,
    },
    select: {
      id: true,
      pageId: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      createdAt: true,
      page: { select: { slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (byPhone) {
    return {
      scanId: byPhone.id,
      pageId: byPhone.pageId,
      pageSlug: byPhone.page.slug,
      utmSource: byPhone.utmSource,
      utmMedium: byPhone.utmMedium,
      utmCampaign: byPhone.utmCampaign,
      matchedBy: "phone",
      ageMinutes: Math.round(
        (Date.now() - byPhone.createdAt.getTime()) / 60000,
      ),
    };
  }

  // Fase 2: fallback por pageSlug — só faz sentido quando há
  // pageSlug e só 1 scan recente (alta probabilidade da mesma
  // pessoa). Skip se o pageSlug não foi fornecido.
  if (!args.pageSlug) return null;

  const recentScans = await prisma.linnkerScan.findMany({
    where: baseWhere,
    select: {
      id: true,
      pageId: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      createdAt: true,
      page: { select: { slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Heurística: se há 1 scan único na janela curta (≤ 30min) sem
  // phone associado ainda, presume que é a mesma pessoa. Mais que
  // isso, fica ambíguo e retornamos null.
  const veryRecent = recentScans.filter(
    (s) =>
      Date.now() - s.createdAt.getTime() < 30 * 60 * 1000,
  );
  if (veryRecent.length === 1) {
    const s = veryRecent[0];
    return {
      scanId: s.id,
      pageId: s.pageId,
      pageSlug: s.page.slug,
      utmSource: s.utmSource,
      utmMedium: s.utmMedium,
      utmCampaign: s.utmCampaign,
      matchedBy: "page_only",
      ageMinutes: Math.round((Date.now() - s.createdAt.getTime()) / 60000),
    };
  }

  return null;
}
