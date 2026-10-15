// Venda guiada com aprovação dos setores (spec 0104). Funções puras, cobertas por scripts/catalog-quote-qa-check.ts.

export type SalesSector = "COMMERCIAL" | "FINANCE" | "LOGISTICS" | "ACCOUNTING";
export type SalesRound = "PRE_PAYMENT" | "POST_PAYMENT";
export type SalesApprovalState = "PENDING" | "APPROVED" | "REJECTED" | "ADJUSTED" | "CANCELED";
export type ApprovalDecision = "approve" | "reject" | "adjust";

export const SALES_SECTOR_LABEL: Record<SalesSector, string> = {
  COMMERCIAL: "Comercial",
  FINANCE: "Financeiro",
  LOGISTICS: "Logística",
  ACCOUNTING: "Contábil",
};

export const SALES_ROUND_LABEL: Record<SalesRound, string> = {
  PRE_PAYMENT: "Antes do valor ir ao cliente",
  POST_PAYMENT: "Depois do pagamento",
};

export const DEFAULT_APPROVAL_TEMPLATES = {
  approval: "aprovacao_pedido",
  postPaymentCheck: "conferencia_pedido_pago",
  reminder: "lembrete_aprovacao_pedido",
  quoteToCustomer: "valor_pedido",
  paymentInReview: "pagamento_em_conferencia",
  deliveryChanged: "prazo_entrega_alterado",
  orderReleased: "pedido_liberado",
  orderReceived: "pedido_recebido",
  orderAwaitingCustomer: "pedido_aguardando_envio",
  productCheck: "consulta_produto",
  orderSeparated: "pedido_separado",
  readyForPickup: "pedido_pronto_retirada",
  onRoute: "pedido_em_rota",
  delivered: "pedido_entregue",
} as const;

export type ApprovalTemplateKey = keyof typeof DEFAULT_APPROVAL_TEMPLATES;
export type ApprovalTemplateNames = Record<ApprovalTemplateKey, string>;

export const APPROVAL_TEMPLATE_LANGUAGE = "pt_BR";

export function resolveApprovalTemplates(stored: unknown): ApprovalTemplateNames {
  const names: ApprovalTemplateNames = { ...DEFAULT_APPROVAL_TEMPLATES };
  if (!stored || typeof stored !== "object") return names;
  for (const key of Object.keys(DEFAULT_APPROVAL_TEMPLATES) as ApprovalTemplateKey[]) {
    const value = (stored as Record<string, unknown>)[key];
    if (typeof value === "string" && /^[a-z0-9_]{1,512}$/.test(value)) names[key] = value;
  }
  return names;
}

const PAYLOAD_PREFIX = "aprov";
const DECISION_CODE: Record<ApprovalDecision, string> = { approve: "A", reject: "R", adjust: "J" };

export function buildApprovalPayload(approvalId: string, decision: ApprovalDecision): string {
  return `${PAYLOAD_PREFIX}:${DECISION_CODE[decision]}:${approvalId}`;
}

export function parseApprovalPayload(payload: string | null | undefined): { approvalId: string; decision: ApprovalDecision } | null {
  if (!payload) return null;
  const match = /^aprov:([ARJ]):([a-z0-9]{10,40})$/i.exec(payload.trim());
  if (!match) return null;
  const decision = (Object.keys(DECISION_CODE) as ApprovalDecision[]).find((key) => DECISION_CODE[key] === match[1].toUpperCase());
  return decision ? { approvalId: match[2], decision } : null;
}

const OPEN_PAYLOAD_PREFIX = "aprovabrir";

/** Botão "Abrir pedido" do lembrete: só reenvia o resumo com os botões de decisão, nunca decide. */
export function buildOpenApprovalPayload(approvalId: string): string {
  return `${OPEN_PAYLOAD_PREFIX}:${approvalId}`;
}

export function parseOpenApprovalPayload(payload: string | null | undefined): string | null {
  const match = /^aprovabrir:([a-z0-9]{10,40})$/i.exec(payload?.trim() ?? "");
  return match ? match[1] : null;
}

export type ApproverIdentity = {
  organizationId: string;
  sector: SalesSector;
  rounds: SalesRound[];
  isActive: boolean;
};

export type ApprovalTarget = {
  organizationId: string;
  sector: SalesSector;
  round: SalesRound;
  status: SalesApprovalState;
};

/** Só o aprovador ativo do setor, na mesma org e na rodada dele, decide (spec 0104, seção 9). */
export function canDecideApproval(approver: ApproverIdentity, approval: ApprovalTarget): boolean {
  return (
    approver.isActive &&
    approver.organizationId === approval.organizationId &&
    approver.sector === approval.sector &&
    approver.rounds.includes(approval.round) &&
    approval.status === "PENDING"
  );
}

export type RoundApproval = {
  sector: SalesSector;
  status: SalesApprovalState;
  note: string | null;
  proposedDeliveryAt: Date | null;
};

export type RoundOutcome =
  | { kind: "open"; pendingSectors: SalesSector[] }
  | { kind: "approved"; deliveryPromiseAt: Date | null; deliveryNotes: string[] }
  | { kind: "back_to_consultant"; reasons: Array<{ sector: SalesSector; note: string | null }> };

/**
 * Rodada fechada = nenhum setor pendente. Recusa, ou ajuste sem prazo (ajuste de preço/condição),
 * devolve ao consultor. Ajuste com prazo conta como aprovação com prazo novo (RF-11).
 */
export function summarizeRound(approvals: RoundApproval[]): RoundOutcome {
  const active = approvals.filter((approval) => approval.status !== "CANCELED");
  const pendingSectors = active.filter((approval) => approval.status === "PENDING").map((approval) => approval.sector);
  if (pendingSectors.length > 0) return { kind: "open", pendingSectors };

  const blocking = active.filter(
    (approval) => approval.status === "REJECTED" || (approval.status === "ADJUSTED" && !approval.proposedDeliveryAt),
  );
  if (blocking.length > 0) {
    return { kind: "back_to_consultant", reasons: blocking.map((approval) => ({ sector: approval.sector, note: approval.note })) };
  }

  const deliveryDates = active
    .map((approval) => approval.proposedDeliveryAt)
    .filter((date): date is Date => date instanceof Date);
  const deliveryPromiseAt = deliveryDates.length > 0 ? new Date(Math.max(...deliveryDates.map((date) => date.getTime()))) : null;
  const deliveryNotes = active
    .filter((approval) => approval.status === "ADJUSTED" && approval.note)
    .map((approval) => approval.note as string);
  return { kind: "approved", deliveryPromiseAt, deliveryNotes };
}

export const APPROVAL_REMINDER_INTERVAL_MS = 2 * 60 * 60 * 1000;

/** Lembrete a cada 2h, só em dia útil das 8h às 18h no fuso da loja (CB-3). */
export function isApprovalReminderDue(params: {
  lastSentAt: Date;
  now: Date;
  localHour: number;
  localWeekday: number;
}): boolean {
  const isBusinessTime = params.localWeekday >= 1 && params.localWeekday <= 5 && params.localHour >= 8 && params.localHour < 18;
  return isBusinessTime && params.now.getTime() - params.lastSentAt.getTime() >= APPROVAL_REMINDER_INTERVAL_MS;
}

export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinServiceWindow(lastInboundAt: Date | null, now: Date): boolean {
  return !!lastInboundAt && now.getTime() - lastInboundAt.getTime() < CUSTOMER_SERVICE_WINDOW_MS;
}

const MAX_TEMPLATE_PARAMETER_LENGTH = 900;

/** A Meta recusa parâmetro com quebra de linha, tab ou 4+ espaços seguidos, e vazio. */
export function toTemplateParameter(value: string | null | undefined, fallback = "-"): string {
  const cleaned = (value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim()
    .slice(0, MAX_TEMPLATE_PARAMETER_LENGTH);
  return cleaned.length > 0 ? cleaned : fallback;
}
