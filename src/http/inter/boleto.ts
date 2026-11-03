import "server-only";
import { InterApiError, interRequest } from "./client";
import type { InterBoleto, InterBoletoInput, InterBoletoList, InterCallContext } from "./types";

// API Cobrança V3 do Inter: boleto com PIX (spec 0133). Emissão assíncrona: o POST devolve só
// o `codigoSolicitacao`; o boleto pronto vem pelo webhook de cobrança ou pela consulta.
// Escopos `boleto-cobranca.read` e `boleto-cobranca.write`.

const BOLETO_PATH = "/cobranca/v3/cobrancas";
const PAGE_SIZE = 1000;

export async function issueInterBoleto(context: InterCallContext, input: InterBoletoInput): Promise<string> {
  const response = await interRequest<{ codigoSolicitacao: string }>(context, {
    method: "POST",
    path: BOLETO_PATH,
    body: input,
  });
  if (!response?.codigoSolicitacao) throw new Error("O Inter não devolveu o código do boleto.");
  return response.codigoSolicitacao;
}

/** `null` quando o Inter não conhece o boleto. */
export async function getInterBoleto(context: InterCallContext, requestId: string): Promise<InterBoleto | null> {
  try {
    return await interRequest<InterBoleto>(context, { method: "GET", path: `${BOLETO_PATH}/${requestId}` });
  } catch (error) {
    if (error instanceof InterApiError && error.status === 404) return null;
    throw error;
  }
}

/** Valor e vencimento novos. O Inter processa em até 30 min. */
export async function reviseInterBoleto(
  context: InterCallContext,
  requestId: string,
  revision: { valorNominal: number; dataVencimento: string },
): Promise<void> {
  await interRequest(context, { method: "PATCH", path: `${BOLETO_PATH}/${requestId}`, body: revision });
}

/** Motivo com até 50 caracteres. */
export async function cancelInterBoleto(context: InterCallContext, requestId: string, reason: string): Promise<void> {
  await interRequest(context, {
    method: "POST",
    path: `${BOLETO_PATH}/${requestId}/cancelar`,
    body: { motivoCancelamento: reason.slice(0, 50) },
  });
}

/** PDF do boleto, em base64. */
export async function getInterBoletoPdf(context: InterCallContext, requestId: string): Promise<string> {
  const response = await interRequest<{ pdf: string }>(context, { method: "GET", path: `${BOLETO_PATH}/${requestId}/pdf` });
  if (!response?.pdf) throw new Error("O Inter não devolveu o PDF do boleto.");
  return response.pdf;
}

/** Boletos pagos no período, pela data do pagamento. */
export async function listInterBoletosPaid(
  context: InterCallContext,
  period: { since: string; until: string },
): Promise<InterBoleto[]> {
  const boletos: InterBoleto[] = [];
  for (let page = 0; ; page += 1) {
    const response = await interRequest<InterBoletoList>(context, {
      method: "GET",
      path: BOLETO_PATH,
      query: {
        dataInicial: period.since,
        dataFinal: period.until,
        filtrarDataPor: "PAGAMENTO",
        situacao: "RECEBIDO",
        "paginacao.itensPorPagina": PAGE_SIZE,
        "paginacao.paginaAtual": page,
      },
    });
    boletos.push(...(response?.cobrancas ?? []));
    if (!response || response.ultimaPagina || page + 1 >= response.totalPaginas) return boletos;
  }
}

/** Webhook de cobrança: um por conta, não por chave. Até 5 chamadas por minuto. */
export async function registerInterBoletoWebhook(context: InterCallContext, webhookUrl: string): Promise<void> {
  if (!webhookUrl.startsWith("https://")) throw new Error("O Inter só aceita webhook em https://.");
  await interRequest(context, { method: "PUT", path: `${BOLETO_PATH}/webhook`, body: { webhookUrl } });
}

export async function deleteInterBoletoWebhook(context: InterCallContext): Promise<void> {
  try {
    await interRequest(context, { method: "DELETE", path: `${BOLETO_PATH}/webhook` });
  } catch (error) {
    if (error instanceof InterApiError && error.status === 404) return;
    throw error;
  }
}
