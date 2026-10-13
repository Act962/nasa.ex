import "server-only";
import WebSocket from "ws";

/**
 * Ponte com a voz em tempo real da OpenAI (spec 0086).
 *
 * A oferta de conexão de áudio que a Meta manda é repassada à OpenAI, que
 * devolve a resposta. O áudio corre direto entre as duas; aqui fica só o canal
 * de controle, por onde chegam os pedidos de ferramenta.
 */

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const REALTIME_SIDEBAND_URL = "wss://api.openai.com/v1/realtime";
const CREATE_CALL_TIMEOUT_MS = 8000;

export interface RealtimeCall {
  realtimeCallId: string;
  sdpAnswer: string;
}

export async function createRealtimeCall(params: {
  apiKey: string;
  sdpOffer: string;
  sessionConfig: Record<string, unknown>;
}): Promise<RealtimeCall> {
  const formData = new FormData();
  formData.set("sdp", params.sdpOffer);
  formData.set("session", JSON.stringify(params.sessionConfig));
  const response = await fetch(REALTIME_CALLS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(CREATE_CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    // O corpo do erro da OpenAI não traz a chave; vai ao log para diagnosticar oferta incompatível.
    const errorText = (await response.text().catch(() => "")).slice(0, 400);
    throw new Error(`realtime_call_rejected status=${response.status} body=${errorText}`);
  }
  const realtimeCallId = response.headers.get("location")?.split("/").pop();
  if (!realtimeCallId) throw new Error("realtime_call_without_id");
  return { realtimeCallId, sdpAnswer: await response.text() };
}

export function openRealtimeSideband(apiKey: string, realtimeCallId: string): WebSocket {
  return new WebSocket(`${REALTIME_SIDEBAND_URL}?call_id=${encodeURIComponent(realtimeCallId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export async function hangUpRealtimeCall(apiKey: string, realtimeCallId: string): Promise<void> {
  await fetch(`${REALTIME_CALLS_URL}/${encodeURIComponent(realtimeCallId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(CREATE_CALL_TIMEOUT_MS),
  }).catch((hangUpError: unknown) =>
    console.warn("[astro-bot/chamada] encerrar na OpenAI falhou:", hangUpError instanceof Error ? hangUpError.name : "erro"),
  );
}
