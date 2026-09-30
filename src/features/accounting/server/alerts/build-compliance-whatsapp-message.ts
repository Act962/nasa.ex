import "server-only";

import type { ComplianceAlertCandidate } from "./collect-compliance-alerts";
import type { ComplianceWhatsAppMessage } from "./send-compliance-whatsapp";

// Um resumo por org e por execução do cron: vários prazos no mesmo dia viram
// uma mensagem só, em vez de uma rajada.

const MAX_LINES = 6;
const CALENDAR_PATH = "/payment?tab=accounting&sub=calendar";

function resolveCalendarUrl(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${appUrl}${CALENDAR_PATH}`;
}

export function buildComplianceWhatsAppMessage(alerts: ComplianceAlertCandidate[]): ComplianceWhatsAppMessage {
  const calendarUrl = resolveCalendarUrl();
  const visibleAlerts = alerts.slice(0, MAX_LINES);
  const hiddenCount = alerts.length - visibleAlerts.length;
  const lines = visibleAlerts.map((alert) => `• ${alert.whatsappLine}`);
  if (hiddenCount > 0) lines.push(`• e mais ${hiddenCount} ${hiddenCount === 1 ? "item" : "itens"}`);

  const text = [
    "*Aviso fiscal da sua empresa (NASA)*",
    "",
    ...lines,
    "",
    `Veja e resolva aqui: ${calendarUrl}`,
  ].join("\n");

  const firstAlert = alerts[0];
  const otherCount = alerts.length - 1;
  const summaryLabel = firstAlert
    ? `${firstAlert.payload.label}${otherCount > 0 ? ` e mais ${otherCount} ${otherCount === 1 ? "item" : "itens"}` : ""}`
    : "Prazos fiscais";

  return {
    text,
    templateParameters: [
      summaryLabel,
      firstAlert?.dueDateLabel || "-",
      firstAlert?.amountLabel || "-",
      calendarUrl,
    ],
  };
}
