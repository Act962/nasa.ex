/**
 * A fronteira da cobrança bancária (spec 0130, D-9).
 *
 * É o lado "para fora" que o `StatementProvider` (statements/ports.ts) não cobre: pedir ao
 * banco um PIX para uma conta a receber e conferir o que foi pago. A régua, a página
 * `/cobranca/<token>` e a baixa automática só conhecem esta interface — o Inter é o
 * primeiro adapter; o Asaas da spec 0115 é o segundo previsto.
 */

export type BankChargeProviderName = "INTER";

export interface PixChargeRequest {
  /** Identificador da cobrança no banco, derivado da conta a receber (`buildPixTxid`). */
  txid: string;
  amountCents: number;
  /** Dia de vencimento, "AAAA-MM-DD". */
  dueDate: string;
  /** Dias em que o PIX ainda aceita pagamento depois do vencimento. */
  daysValidAfterDue: number;
  debtor: { name: string; document: string } | null;
  /** Texto mostrado ao pagador no app do banco (até 140 caracteres). */
  payerMessage?: string;
}

export interface PixCharge {
  txid: string;
  copyPaste: string;
  status: "ACTIVE" | "PAID" | "REMOVED";
  amountCents: number;
  dueDate: string;
}

/** Pagamento confirmado pelo próprio banco — nunca pelo corpo de um aviso. */
export interface ConfirmedPixPayment {
  endToEndId: string;
  txid: string | null;
  amountCents: number;
  paidAt: Date;
  payerName: string | null;
  payerDocument: string | null;
  /** Já houve devolução (estorno) deste PIX. */
  hasRefund: boolean;
  raw: Record<string, unknown>;
}

export interface BankChargeProvider {
  readonly provider: BankChargeProviderName;
  /** Cria ou revisa o PIX. Repetível: o mesmo `txid` nunca vira duas cobranças. */
  upsertPixCharge(request: PixChargeRequest): Promise<PixCharge>;
  /** Remove um PIX em aberto, para o cliente não pagar duas vezes (RF-7). */
  cancelPixCharge(txid: string): Promise<void>;
  /** Consulta o pagamento no banco. `null` quando o banco não o conhece. */
  confirmPixPayment(endToEndId: string): Promise<ConfirmedPixPayment | null>;
  /** PIX de cobrança recebidos no período (rede de segurança, RF-11). */
  listPixPayments(period: { since: Date; until: Date }): Promise<ConfirmedPixPayment[]>;
}

const TXID_PREFIX = "orb";
const TXID_PATTERN = /^[a-zA-Z0-9]{26,35}$/;

/** `orb` + id da conta a receber: o Bacen exige 26 a 35 caracteres alfanuméricos. */
export function buildPixTxid(entryId: string): string {
  const txid = `${TXID_PREFIX}${entryId}`;
  if (!TXID_PATTERN.test(txid)) throw new Error(`Id de conta a receber não serve de txid: ${entryId}`);
  return txid;
}

/** Desfaz o `buildPixTxid`. `null` quando o PIX não foi gerado pelo ÓRBITA. */
export function parsePixTxid(txid: string | null | undefined): string | null {
  if (!txid || !txid.startsWith(TXID_PREFIX)) return null;
  return txid.slice(TXID_PREFIX.length);
}
