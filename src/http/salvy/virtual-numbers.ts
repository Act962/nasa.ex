// Números virtuais da Salvy (API v2): DDDs, criar, cancelar e SMS recebidos.

import "server-only";
import { salvyFetch } from "./client";

export interface SalvyVirtualNumber {
  id: string;
  /** E.164, ex.: +551151231234 */
  phoneNumber: string;
  name: string | null;
  status: "pending" | "active" | "blocked" | "canceled";
  createdAt: string;
}

export interface SalvySmsMessage {
  id: string;
  receivedAt: string;
  originPhoneNumber: string;
  destinationPhoneNumber: string;
  message: string;
  detections?: { whatsapp?: { verificationCode?: string } };
}

export async function listAvailableAreaCodes(): Promise<number[]> {
  const response = await salvyFetch<{ areaCodes: { areaCode: number; available: boolean }[] }>(
    "/api/v2/virtual-phone-accounts/area-codes?available=true",
  );
  return response.areaCodes.filter((areaCode) => areaCode.available).map((areaCode) => areaCode.areaCode);
}

export async function createVirtualNumber(params: { areaCode: number; name: string }): Promise<SalvyVirtualNumber> {
  return salvyFetch<SalvyVirtualNumber>("/api/v2/virtual-phone-accounts", {
    method: "POST",
    body: JSON.stringify({ areaCode: params.areaCode, name: params.name }),
  });
}

/** A Salvy cobra o mês inteiro do cancelamento. */
export async function cancelVirtualNumber(salvyId: string, reason = "unnecessary"): Promise<void> {
  await salvyFetch<void>(`/api/v2/virtual-phone-accounts/${encodeURIComponent(salvyId)}?reason=${encodeURIComponent(reason)}`, {
    method: "DELETE",
  });
}

/** SMS recebidos desde `since`, mais recente primeiro. */
export async function listSmsMessages(salvyId: string, since: Date): Promise<SalvySmsMessage[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "20", receivedAtFrom: since.toISOString() });
  const response = await salvyFetch<{ smsMessages: SalvySmsMessage[] }>(
    `/api/v2/virtual-phone-accounts/${encodeURIComponent(salvyId)}/sms-messages?${query.toString()}`,
  );
  return response.smsMessages;
}

/** Código de verificação do WhatsApp mais recente (a Salvy já detecta no SMS). */
export function latestWhatsAppCode(messages: SalvySmsMessage[]): { code: string; receivedAt: string } | null {
  for (const message of messages) {
    const detected = message.detections?.whatsapp?.verificationCode ?? message.message.match(/\b(\d{3})-?(\d{3})\b/)?.slice(1).join("");
    if (detected) return { code: detected, receivedAt: message.receivedAt };
  }
  return null;
}
