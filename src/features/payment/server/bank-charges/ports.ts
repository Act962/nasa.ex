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

/** Credenciais de uma conexão, já decifradas, só em memória. */
export interface BankCredentials {
  environment: "production" | "sandbox";
  clientId: string;
  clientSecret: string;
  certificatePem: string | null;
  privateKeyPem: string | null;
  pixKey: string;
  accountNumber: string | null;
}

export interface BankAccessToken {
  accessToken: string;
  expiresAt: Date;
  scopes: string[];
}

/** Erro com mensagem em português, pronta para a tela. */
export class BankConnectionError extends Error {
  constructor(message: string, readonly isCredentialProblem = false) {
    super(message);
    this.name = "BankConnectionError";
  }
}

/**
 * Permissões conferidas chamando a API do banco (spec 0133): o token do Inter repete qualquer
 * escopo pedido, então ele não prova nada. `null` em `missingForBoleto` = o banco não tem boleto.
 */
export interface BankPermissionReport {
  granted: string[];
  missingForPix: string[];
  missingForBoleto: string[] | null;
  /** Permissões que tiram dinheiro da conta. O ÓRBITA nunca usa; a tela pede para remover. */
  moneyMoving: string[];
  /** Token de trabalho emitido na conferência (com o boleto, se ele estiver liberado). */
  workingToken: BankAccessToken;
}

export interface BoletoPayer {
  document: string;
  name: string;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zipCode: string;
  email: string | null;
}

export interface BoletoRequest {
  /** Referência curta da conta a receber (o banco aceita até 15 caracteres). */
  reference: string;
  amountCents: number;
  /** "AAAA-MM-DD". */
  dueDate: string;
  /** Dias depois do vencimento até o boleto expirar no banco. */
  daysValidAfterDue: number;
  payer: BoletoPayer;
  finePercent: number | null;
  interestMonthlyPercent: number | null;
  discount: { percent: number; daysBeforeDue: number } | null;
  message: string | null;
}

export type BankBoletoStatus = "PROCESSING" | "ACTIVE" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED";

export interface BankBoleto {
  requestId: string;
  /** A referência enviada na emissão (`BoletoRequest.reference`). */
  reference: string | null;
  status: BankBoletoStatus;
  amountCents: number;
  dueDate: string;
  digitableLine: string | null;
  barcode: string | null;
  pixCopyPaste: string | null;
  paidAmountCents: number | null;
  paidAt: Date | null;
  paidVia: "BOLETO" | "PIX" | null;
  payerName: string | null;
  payerDocument: string | null;
  raw: Record<string, unknown>;
}

/** Boleto com PIX no banco (spec 0133). Emissão assíncrona: o boleto pronto vem depois. */
export interface BankBoletoProvider {
  /** Devolve o identificador do pedido; o boleto fica pronto em segundos. */
  issueBoleto(request: BoletoRequest): Promise<string>;
  getBoleto(requestId: string): Promise<BankBoleto | null>;
  /** Pode levar até 30 min para valer no banco. */
  reviseBoleto(requestId: string, revision: { amountCents: number; dueDate: string }): Promise<void>;
  cancelBoleto(requestId: string, reason: string): Promise<void>;
  /** PDF em base64. */
  getBoletoPdf(requestId: string): Promise<string>;
  listPaidBoletos(period: { since: Date; until: Date }): Promise<BankBoleto[]>;
}

/**
 * Tudo o que o ÓRBITA precisa de um banco: conferir e guardar a conexão, renovar o token,
 * cadastrar o aviso de pagamento e montar o `BankChargeProvider`. Banco novo = um adapter
 * novo registrado em `bank-adapters.ts`; tela, régua e baixa não mudam.
 */
export interface BankAdapter {
  readonly provider: BankChargeProviderName;
  /** Permissões que cada forma de cobrar exige. `boleto: null` = o banco não emite boleto pela API. */
  readonly permissionScopes: { pix: readonly string[]; boleto: readonly string[] | null };
  /** Confere os arquivos antes de chamar o banco. Lança `BankConnectionError`. */
  inspectCredentials(credentials: BankCredentials): { certificateValidTo: Date | null };
  /** Token de trabalho: permissões do PIX e, se pedido, as do boleto. */
  requestAccessToken(credentials: BankCredentials, options?: { includeBoleto?: boolean }): Promise<BankAccessToken>;
  /** Confere de verdade o que a integração pode fazer, sem criar nada no banco. Também valida as credenciais. */
  checkPermissions(credentials: BankCredentials): Promise<BankPermissionReport>;
  /** Escopos que tiram dinheiro da conta, entre os informados. */
  findMoneyMovingScopes(scopes: readonly string[]): string[];
  createChargeProvider(credentials: BankCredentials, getAccessToken: () => Promise<string>): BankChargeProvider;
  registerPaymentWebhook(credentials: BankCredentials, accessToken: string, webhookUrl: string): Promise<void>;
  removePaymentWebhook(credentials: BankCredentials, accessToken: string): Promise<void>;
  /** Ausentes quando o banco não emite boleto pela API. */
  createBoletoProvider?(credentials: BankCredentials, getAccessToken: () => Promise<string>): BankBoletoProvider;
  registerBoletoWebhook?(credentials: BankCredentials, accessToken: string, webhookUrl: string): Promise<void>;
  removeBoletoWebhook?(credentials: BankCredentials, accessToken: string): Promise<void>;
  /** Mensagem em português para um erro do banco; `null` se não for erro dele. */
  describeError(error: unknown): { message: string; isCredentialProblem: boolean } | null;
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
