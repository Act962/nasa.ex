import "server-only";
import { InterApiError } from "@/http/inter/client";
import { createInterCobv, getInterCobv, removeInterCobv, reviseInterCobv } from "@/http/inter/cobv";
import { getInterPix, listInterPixReceived } from "@/http/inter/pix";
import type {
  InterCallContext,
  InterCobv,
  InterDebtor,
  InterEnv,
  InterPixReceived,
} from "@/http/inter/types";
import type { BankChargeProvider, ConfirmedPixPayment, PixCharge, PixChargeRequest } from "./ports";

// Adapter do Inter para a porta de cobrança (spec 0130). Não sabe de banco de dados: quem
// monta a conexão decifra as credenciais e fornece o token já guardado (D-6).

export interface InterConnection {
  env: InterEnv;
  certificatePem: string;
  privateKeyPem: string;
  pixKey: string;
  accountNumber: string | null;
  /** Token válido, reaproveitado entre chamadas; renovar é com quem chama. */
  getAccessToken: () => Promise<string>;
  timeoutMs?: number;
}

/** Um PIX removido não pode voltar com o mesmo `txid` (regra do Bacen). */
export class PixChargeRemovedError extends Error {
  constructor(readonly txid: string) {
    super("A cobrança PIX desta conta foi removida no Inter e não pode ser reaberta com o mesmo identificador.");
    this.name = "PixChargeRemovedError";
  }
}

function centsToReais(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function reaisToCents(amountReais: string): number {
  return Math.round(Number(amountReais) * 100);
}

function toInterDebtor(debtor: PixChargeRequest["debtor"]): InterDebtor | undefined {
  if (!debtor) return undefined;
  const digits = debtor.document.replace(/\D/g, "");
  const name = debtor.name.slice(0, 200);
  if (digits.length === 11) return { cpf: digits, nome: name };
  if (digits.length === 14) return { cnpj: digits, nome: name };
  return undefined;
}

function toPixCharge(cobv: InterCobv): PixCharge {
  if (!cobv.pixCopiaECola) throw new Error("O Inter não devolveu o copia e cola da cobrança.");
  const status = cobv.status === "ATIVA" ? "ACTIVE" : cobv.status === "CONCLUIDA" ? "PAID" : "REMOVED";
  return {
    txid: cobv.txid,
    copyPaste: cobv.pixCopiaECola,
    status,
    amountCents: reaisToCents(cobv.valor.original),
    dueDate: cobv.calendario.dataDeVencimento,
  };
}

function toConfirmedPayment(pix: InterPixReceived): ConfirmedPixPayment {
  const payerDocument = pix.pagador?.cpf ?? pix.pagador?.cnpj ?? null;
  return {
    endToEndId: pix.endToEndId,
    txid: pix.txid ?? null,
    amountCents: reaisToCents(pix.valor),
    paidAt: new Date(pix.horario),
    payerName: pix.pagador?.nome ?? null,
    payerDocument,
    hasRefund: (pix.devolucoes?.length ?? 0) > 0,
    raw: pix as unknown as Record<string, unknown>,
  };
}

async function findCobv(context: InterCallContext, txid: string): Promise<InterCobv | null> {
  try {
    return await getInterCobv(context, txid);
  } catch (error) {
    if (error instanceof InterApiError && error.status === 404) return null;
    throw error;
  }
}

export function createInterChargeProvider(connection: InterConnection): BankChargeProvider {
  async function buildContext(): Promise<InterCallContext> {
    return {
      env: connection.env,
      certificatePem: connection.certificatePem,
      privateKeyPem: connection.privateKeyPem,
      accountNumber: connection.accountNumber,
      accessToken: await connection.getAccessToken(),
      timeoutMs: connection.timeoutMs,
    };
  }

  return {
    provider: "INTER",

    async upsertPixCharge(request) {
      const context = await buildContext();
      const amount = centsToReais(request.amountCents);
      const calendario = { dataDeVencimento: request.dueDate, validadeAposVencimento: request.daysValidAfterDue };
      let existing = await findCobv(context, request.txid);

      if (!existing) {
        try {
          const created = await createInterCobv(context, request.txid, {
            calendario,
            devedor: toInterDebtor(request.debtor),
            valor: { original: amount },
            chave: connection.pixKey,
            solicitacaoPagador: request.payerMessage?.slice(0, 140),
          });
          return toPixCharge(created);
        } catch (error) {
          // Outra chamada criou o mesmo txid entre o GET e o PUT (página aberta junto com a
          // régua): segue com o que ela criou, em vez de cair no PIX estático.
          const raced = error instanceof InterApiError ? await findCobv(context, request.txid) : null;
          if (!raced) throw error;
          existing = raced;
        }
      }

      if (existing.status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || existing.status === "REMOVIDA_PELO_PSP") {
        throw new PixChargeRemovedError(request.txid);
      }
      if (existing.status === "CONCLUIDA") return toPixCharge(existing);

      const isUpToDate =
        existing.valor.original === amount && existing.calendario.dataDeVencimento === request.dueDate;
      if (isUpToDate) return toPixCharge(existing);

      const revised = await reviseInterCobv(context, request.txid, { calendario, valor: { original: amount } });
      return toPixCharge(revised);
    },

    async cancelPixCharge(txid) {
      const context = await buildContext();
      const existing = await findCobv(context, txid);
      if (!existing || existing.status !== "ATIVA") return;
      await removeInterCobv(context, txid);
    },

    async confirmPixPayment(endToEndId) {
      const context = await buildContext();
      try {
        return toConfirmedPayment(await getInterPix(context, endToEndId));
      } catch (error) {
        if (error instanceof InterApiError && error.status === 404) return null;
        throw error;
      }
    },

    async listPixPayments(period) {
      const context = await buildContext();
      const received = await listInterPixReceived(context, period);
      return received.map(toConfirmedPayment);
    },
  };
}
