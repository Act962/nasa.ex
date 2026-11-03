import "server-only";
import { interRequest } from "./client";
import type { InterCallContext, InterPixListResponse, InterPixReceived } from "./types";

// PIX recebidos. Só aparecem aqui os que vieram de uma cobrança (cob/cobv) paga pelo QR:
// PIX feito direto na chave não passa por esta API (spec 0130, CB-1).

/** Escopo `pix.read`. É a conferência que o webhook não substitui (RNF-4). */
export async function getInterPix(context: InterCallContext, endToEndId: string): Promise<InterPixReceived> {
  const body = await interRequest<InterPixReceived>(context, {
    method: "GET",
    path: `/pix/v2/pix/${encodeURIComponent(endToEndId)}`,
  });
  if (!body) throw new Error("O Inter não devolveu o PIX consultado.");
  return body;
}

const PAGE_SIZE = 1000;

/** Escopo `pix.read`. Lê todas as páginas do período. Usado pela rede de segurança (RF-11). */
export async function listInterPixReceived(
  context: InterCallContext,
  period: { since: Date; until: Date },
): Promise<InterPixReceived[]> {
  const received: InterPixReceived[] = [];
  for (let page = 0; ; page++) {
    const body = await interRequest<InterPixListResponse>(context, {
      method: "GET",
      path: "/pix/v2/pix",
      query: {
        inicio: period.since.toISOString(),
        fim: period.until.toISOString(),
        txIdPresente: true,
        "paginacao.paginaAtual": page,
        "paginacao.itensPorPagina": PAGE_SIZE,
      },
    });
    const pagePix = body?.pix ?? [];
    received.push(...pagePix);
    const totalPages = body?.parametros.paginacao.quantidadeDePaginas;
    const isLastPage = totalPages === undefined ? pagePix.length < PAGE_SIZE : page + 1 >= totalPages;
    if (isLastPage) return received;
  }
}
