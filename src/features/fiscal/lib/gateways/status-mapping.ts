import type { FiscalInvoiceStatus } from "@/generated/prisma/enums";

export function focusStatusToDb(focusStatus: string): FiscalInvoiceStatus {
  switch (focusStatus) {
    case "autorizado":
      return "AUTORIZADO";
    case "erro_autorizacao":
      return "ERRO";
    case "cancelado":
      return "CANCELADO";
    default:
      return "PROCESSANDO";
  }
}

// flowStatus da NFE.io → status do banco. CancelFailed mantém AUTORIZADO (a
// nota segue válida; a falha de cancelamento vai para errorMessage).
export function nfeIoFlowStatusToDb(
  flowStatus: string | null | undefined,
): FiscalInvoiceStatus {
  switch (flowStatus) {
    case "Issued":
      return "AUTORIZADO";
    case "Cancelled":
      return "CANCELADO";
    case "IssueFailed":
      return "ERRO";
    case "CancelFailed":
      return "AUTORIZADO";
    default:
      return "PROCESSANDO";
  }
}

// O webhook entrega o evento no campo `action` em forma curta (ex.:
// "issued_successfully"), enquanto os filtros são registrados com o prefixo do
// recurso ("service_invoice.issued_successfully"). Mapeamos as duas formas.
const NFE_IO_WEBHOOK_EVENT_STATUS: Record<string, string> = {
  issued_successfully: "Issued",
  issued_failed: "IssueFailed",
  issued_error: "IssueFailed",
  cancelled_successfully: "Cancelled",
  cancelled_failed: "CancelFailed",
  cancelled_error: "CancelFailed",
  "service_invoice.issued_successfully": "Issued",
  "service_invoice.issued_failed": "IssueFailed",
  "service_invoice.issued_error": "IssueFailed",
  "service_invoice.cancelled_successfully": "Cancelled",
  "service_invoice.cancelled_failed": "CancelFailed",
  "service_invoice.cancelled_error": "CancelFailed",
};

export function nfeIoWebhookEventToFlowStatus(
  eventName: string | null | undefined,
): string | null {
  if (!eventName) return null;
  // Normaliza "service_invoice.xxx" → "xxx" também, por robustez.
  const normalized = eventName.includes(".")
    ? eventName.slice(eventName.lastIndexOf(".") + 1)
    : eventName;
  return (
    NFE_IO_WEBHOOK_EVENT_STATUS[eventName] ??
    NFE_IO_WEBHOOK_EVENT_STATUS[normalized] ??
    null
  );
}
