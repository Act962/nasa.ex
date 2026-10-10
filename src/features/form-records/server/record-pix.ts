import "server-only";
import { requestLeadMetricsRecompute } from "@/features/leads/lib/metrics/request-recompute";
import prisma from "@/lib/prisma";
import { buildPixBrCode } from "@/features/form-records/lib/pix-br-code";
import { formatCents } from "@/features/form-records/lib/measure-units";
import { deliverTextToLead } from "@/features/nerp-catalog/lib/order-channel";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";

// PIX das fichas (spec 0081, parte D): a chave é a mesma das Propostas, guardada em
// `ForgeSettings.paymentGatewayConfigs.PIX`. O envio é um "copia e cola" estático; a baixa é manual.

export interface PixSettings {
  pixKey: string;
  receiverName: string;
  receiverCity: string;
}

type GatewayConfigs = Record<string, Record<string, unknown> | undefined>;

function readPixConfig(rawConfigs: unknown): PixSettings {
  const pixConfig = ((rawConfigs ?? {}) as GatewayConfigs).PIX ?? {};
  const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return { pixKey: readText(pixConfig.pixKey), receiverName: readText(pixConfig.pixName), receiverCity: readText(pixConfig.pixCity) };
}

export async function getPixSettings(organizationId: string): Promise<PixSettings> {
  const settings = await prisma.forgeSettings.findUnique({ where: { organizationId }, select: { paymentGatewayConfigs: true } });
  return readPixConfig(settings?.paymentGatewayConfigs);
}

/** Mescla só o bloco PIX: as credenciais dos outros gateways ficam como estão. */
export async function savePixSettings(organizationId: string, pixSettings: PixSettings): Promise<void> {
  const settings = await prisma.forgeSettings.findUnique({ where: { organizationId }, select: { paymentGatewayConfigs: true } });
  const currentConfigs = (settings?.paymentGatewayConfigs ?? {}) as GatewayConfigs;
  const paymentGatewayConfigs = {
    ...currentConfigs,
    PIX: { ...(currentConfigs.PIX ?? {}), pixKey: pixSettings.pixKey, pixName: pixSettings.receiverName, pixCity: pixSettings.receiverCity },
  };
  await prisma.forgeSettings.upsert({
    where: { organizationId },
    create: { organizationId, paymentGatewayConfigs },
    update: { paymentGatewayConfigs },
  });
}

export type SendRecordPixResult =
  | { isSent: true; leadName: string; amountCents: number }
  | { isSent: false; reason: "record_not_found" | "not_finalized" | "no_amount" | "no_client" | "no_phone" | "no_pix_key" | "no_whatsapp" | "send_failed"; message: string };

const FAILURE_MESSAGES = {
  record_not_found: "Ficha não encontrada.",
  not_finalized: "A ficha ainda é rascunho. Finalize antes de cobrar.",
  no_amount: "Esta ficha não tem valor a cobrar.",
  no_client: "A ficha não tem cliente.",
  no_phone: "O cliente não tem telefone cadastrado.",
  no_pix_key: "Cadastre a chave PIX, o nome do recebedor e a cidade em Fichas › Chave PIX.",
  no_whatsapp: "O funil desse cliente não tem WhatsApp conectado.",
  send_failed: "O WhatsApp recusou o envio.",
} as const;

export type RecordPixFailure = Extract<SendRecordPixResult, { isSent: false }>;

function failure(reason: RecordPixFailure["reason"], detail?: string): RecordPixFailure {
  return { isSent: false, reason, message: detail ?? FAILURE_MESSAGES[reason] };
}

async function loadChargeableRecord(organizationId: string, recordId: string) {
  return prisma.formRecord.findFirst({
    where: { id: recordId, organizationId },
    select: {
      id: true,
      label: true,
      leadId: true,
      usageTotalCents: true,
      finalizedAt: true,
      pixSentAt: true,
      paidAt: true,
      form: { select: { name: true } },
    },
  });
}

/** Confere tudo o que impede a cobrança, sem enviar. Serve ao ensaio do ASTRO e à tela. */
export async function checkRecordPix(params: { organizationId: string; recordId: string }) {
  const record = await loadChargeableRecord(params.organizationId, params.recordId);
  if (!record) return { failure: failure("record_not_found") } as const;
  if (!record.finalizedAt) return { failure: failure("not_finalized") } as const;
  if (record.usageTotalCents <= 0) return { failure: failure("no_amount") } as const;
  if (!record.leadId) return { failure: failure("no_client") } as const;

  const lead = await prisma.lead.findFirst({
    where: { id: record.leadId, tracking: { organizationId: params.organizationId } },
    select: { id: true, name: true, phone: true, trackingId: true, conversation: { select: { id: true } } },
  });
  if (!lead) return { failure: failure("no_client") } as const;
  if (!lead.phone) return { failure: failure("no_phone") } as const;

  const pixSettings = await getPixSettings(params.organizationId);
  if (!pixSettings.pixKey || !pixSettings.receiverName || !pixSettings.receiverCity) return { failure: failure("no_pix_key") } as const;
  // `failure: null` explícito: é por ele que quem chama separa os dois casos sem ambiguidade de tipo.
  return { failure: null, record, lead: { ...lead, phone: lead.phone }, pixSettings } as const;
}

/** Envia ao cliente o valor e, em mensagem separada, o código para copiar com um toque. */
export async function sendRecordPix(params: { organizationId: string; recordId: string; senderName: string }): Promise<SendRecordPixResult> {
  const checked = await checkRecordPix(params);
  if (checked.failure) return checked.failure;
  const { record, lead, pixSettings } = checked;

  const recordTitle = record.label ? `${record.form.name} · ${record.label}` : record.form.name;
  const brCode = buildPixBrCode({
    pixKey: pixSettings.pixKey,
    receiverName: pixSettings.receiverName,
    receiverCity: pixSettings.receiverCity,
    amountCents: record.usageTotalCents,
    transactionId: record.id.slice(-20),
  });
  const firstName = lead.name.trim().split(/\s+/)[0];
  const messages = [
    `Olá, ${firstName}! Segue o PIX do atendimento:\n\n*${recordTitle}*\nValor: *${formatCents(record.usageTotalCents)}*\nRecebedor: ${pixSettings.receiverName}\n\nCopie o código abaixo e cole no app do seu banco, em PIX Copia e Cola:`,
    brCode,
  ];

  try {
    if (lead.conversation) {
      // Pela conversa: a mensagem aparece no chat do cliente, como as demais.
      for (const text of messages) {
        await deliverTextToLead({ conversationId: lead.conversation.id, text, senderName: params.senderName, metadata: { kind: "form_record_pix", formRecordId: record.id } });
      }
    } else {
      const resolved = await resolveOutboundProvider(lead.trackingId).catch(() => null);
      if (!resolved) return failure("no_whatsapp");
      for (const text of messages) await resolved.provider.sendText({ kind: "text", to: lead.phone, body: text });
    }
  } catch (sendError) {
    console.error("[form-records/pix] envio falhou", { recordId: record.id, sendError });
    return failure("send_failed", sendError instanceof Error ? `O WhatsApp recusou o envio: ${sendError.message}` : undefined);
  }

  await prisma.formRecord.update({ where: { id: record.id }, data: { pixSentAt: new Date() } });
  return { isSent: true, leadName: lead.name, amountCents: record.usageTotalCents };
}

/** Baixa manual. `isPaid: false` desfaz, para quem marcou a ficha errada. */
export async function setRecordPaid(params: { organizationId: string; recordId: string; isPaid: boolean }): Promise<boolean> {
  const updated = await prisma.formRecord.updateMany({
    where: { id: params.recordId, organizationId: params.organizationId, finalizedAt: { not: null } },
    data: { paidAt: params.isPaid ? new Date() : null },
  });
  if (updated.count > 0) {
    // Ficha paga conta como compra na Visão do Lead (spec 0085).
    const record = await prisma.formRecord.findUnique({ where: { id: params.recordId }, select: { leadId: true } });
    if (record?.leadId) await requestLeadMetricsRecompute(record.leadId);
  }
  return updated.count > 0;
}
