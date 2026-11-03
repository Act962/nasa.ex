import "server-only";
import {
  cancelInterBoleto,
  getInterBoleto,
  getInterBoletoPdf,
  issueInterBoleto,
  listInterBoletosPaid,
  reviseInterBoleto,
} from "@/http/inter/boleto";
import type { InterBoleto, InterBoletoInput, InterBoletoSituation, InterCallContext } from "@/http/inter/types";
import { parseCalendarDate } from "@/features/payment/lib/dates";
import type { BankBoleto, BankBoletoProvider, BankBoletoStatus, BoletoRequest } from "./ports";

// Adapter do boleto com PIX do Inter (API Cobrança V3) para a porta `BankBoletoProvider` (spec 0133).

const STATUS_BY_SITUATION: Record<InterBoletoSituation, BankBoletoStatus> = {
  EM_PROCESSAMENTO: "PROCESSING",
  A_RECEBER: "ACTIVE",
  ATRASADO: "ACTIVE",
  PROTESTO: "ACTIVE",
  RECEBIDO: "PAID",
  MARCADO_RECEBIDO: "PAID",
  CANCELADO: "CANCELLED",
  EXPIRADO: "EXPIRED",
  FALHA_EMISSAO: "FAILED",
};

function toCents(amountReais: number | string | undefined): number | null {
  if (amountReais === undefined || amountReais === "") return null;
  return Math.round(Number(amountReais) * 100);
}

/** O banco devolve o dia do pagamento sem hora; meio-dia UTC mantém o dia em qualquer fuso. */
function toPaidAt(situationDate: string | undefined): Date | null {
  if (!situationDate) return null;
  return parseCalendarDate(situationDate.slice(0, 10));
}

export function toBankBoleto(boleto: InterBoleto): BankBoleto {
  const { cobranca } = boleto;
  const status = STATUS_BY_SITUATION[cobranca.situacao] ?? "ACTIVE";
  const isPaid = status === "PAID";
  return {
    requestId: cobranca.codigoSolicitacao,
    reference: cobranca.seuNumero || null,
    status,
    amountCents: toCents(cobranca.valorNominal) ?? 0,
    dueDate: cobranca.dataVencimento,
    digitableLine: boleto.boleto?.linhaDigitavel ?? null,
    barcode: boleto.boleto?.codigoBarras ?? null,
    pixCopyPaste: boleto.pix?.pixCopiaECola ?? null,
    paidAmountCents: isPaid ? toCents(cobranca.valorTotalRecebido) : null,
    paidAt: isPaid ? toPaidAt(cobranca.dataSituacao) : null,
    paidVia: isPaid ? (cobranca.origemRecebimento ?? null) : null,
    payerName: cobranca.pagador?.nome ?? null,
    payerDocument: cobranca.pagador?.cpfCnpj?.replace(/\D/g, "") ?? null,
    raw: boleto as unknown as Record<string, unknown>,
  };
}

function toInterBoletoInput(request: BoletoRequest): InterBoletoInput {
  const { payer } = request;
  return {
    seuNumero: request.reference.slice(0, 15),
    valorNominal: request.amountCents / 100,
    dataVencimento: request.dueDate,
    numDiasAgenda: request.daysValidAfterDue,
    pagador: {
      cpfCnpj: payer.document,
      tipoPessoa: payer.document.length === 14 ? "JURIDICA" : "FISICA",
      nome: payer.name.slice(0, 100),
      endereco: payer.street.slice(0, 100),
      numero: payer.number?.slice(0, 10) || undefined,
      complemento: payer.complement?.slice(0, 30) || undefined,
      bairro: payer.neighborhood?.slice(0, 60) || undefined,
      cidade: payer.city.slice(0, 60),
      uf: payer.state.toUpperCase(),
      cep: payer.zipCode,
      email: payer.email?.slice(0, 50) || undefined,
    },
    multa: request.finePercent ? { taxa: request.finePercent, codigo: "PERCENTUAL" } : undefined,
    mora: request.interestMonthlyPercent ? { taxa: request.interestMonthlyPercent, codigo: "TAXAMENSAL" } : undefined,
    desconto: request.discount
      ? { taxa: request.discount.percent, codigo: "PERCENTUALDATAINFORMADA", quantidadeDias: request.discount.daysBeforeDue }
      : undefined,
    mensagem: request.message ? { linha1: request.message.slice(0, 78) } : undefined,
    formasRecebimento: ["BOLETO", "PIX"],
  };
}

export function createInterBoletoProvider(buildContext: () => Promise<InterCallContext>): BankBoletoProvider {
  return {
    async issueBoleto(request) {
      return issueInterBoleto(await buildContext(), toInterBoletoInput(request));
    },

    async getBoleto(requestId) {
      const boleto = await getInterBoleto(await buildContext(), requestId);
      return boleto ? toBankBoleto(boleto) : null;
    },

    async reviseBoleto(requestId, revision) {
      await reviseInterBoleto(await buildContext(), requestId, {
        valorNominal: revision.amountCents / 100,
        dataVencimento: revision.dueDate,
      });
    },

    async cancelBoleto(requestId, reason) {
      await cancelInterBoleto(await buildContext(), requestId, reason);
    },

    async getBoletoPdf(requestId) {
      return getInterBoletoPdf(await buildContext(), requestId);
    },

    async listPaidBoletos(period) {
      const boletos = await listInterBoletosPaid(await buildContext(), {
        since: period.since.toISOString().slice(0, 10),
        until: period.until.toISOString().slice(0, 10),
      });
      return boletos.map(toBankBoleto);
    },
  };
}
