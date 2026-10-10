import "server-only";
import type WebSocket from "ws";
import type { OrganizationBotConfig, UserWhatsappBinding } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import { meter } from "@/features/stars/lib/metering";
import { ASTRO_VOICE_TOOL_NAME } from "@/features/astro/server/voice/build-voice-session-config";
import { sendOfficialCallAction } from "@/http/whats-oficial/calls";
import { handleBotCommand } from "../router";
import { TrackingProviderBotChannel } from "../tracking-provider-channel";
import { canBeSpoken, toSpeakableText } from "../voice/speakable-text";
import {
  CALL_WARNING_MS,
  MAX_CALL_MS,
  buildCallSessionConfig,
  buildGreetingInstructions,
} from "./call-config";
import { createMediaRelay, type MediaRelay } from "./media-relay";
import { hangUpRealtimeCall, openRealtimeSideband } from "./realtime-call";

/**
 * Uma chamada de voz do Astro em andamento (spec 0086).
 *
 * O canal de controle vive na memória deste processo enquanto a chamada dura:
 * um deploy no meio derruba a chamada. Aceito na prova de conceito.
 */

const SECONDS_PER_MINUTE = 60;
const CALL_FAILED_TEXT = "Não consegui atender por voz agora. Me escreva por aqui.";
const SENT_BY_MESSAGE_OUTPUT =
  "A resposta foi enviada por mensagem de texto no WhatsApp, porque tem itens que não devem ser falados ou precisa de confirmação por botão. Avise que mandou por mensagem e não tente ler o conteúdo.";

export interface CallInstance {
  accessToken: string;
  phoneNumberId: string;
  trackingId: string;
  organizationId: string;
}

interface ActiveCall {
  metaCallId: string;
  realtimeCallId: string;
  apiKey: string;
  instance: CallInstance;
  binding: UserWhatsappBinding;
  callerPhone: string;
  startedAt: number;
  sideband: WebSocket;
  relay: MediaRelay;
  timers: NodeJS.Timeout[];
  questions: string[];
  hasEnded: boolean;
}

const activeCalls = new Map<string, ActiveCall>();

export function hasActiveCallFor(bindingId: string): boolean {
  return [...activeCalls.values()].some((call) => call.binding.id === bindingId && !call.hasEnded);
}

async function resolveOpenAiKey(organizationId: string): Promise<string | null> {
  return (await loadOrganizationKeys(organizationId)).openai?.apiKey ?? envKeyFor("openai") ?? null;
}

/** Roda o pedido pelo mesmo caminho da mensagem de texto: permissões, consultas em código e cobrança (RF-4). */
async function consultAstro(call: ActiveCall, botConfig: OrganizationBotConfig, question: string): Promise<string> {
  call.questions.push(question);
  const textChannel = new TrackingProviderBotChannel(call.instance.trackingId);
  const result = await handleBotCommand(
    { binding: call.binding, botConfig, channel: textChannel, trackingId: call.instance.trackingId },
    question,
  );
  const hasButtons = Boolean(result.buttons && result.buttons.length > 0);
  if (result.status === "ok" && !hasButtons && canBeSpoken(result.reply)) return toSpeakableText(result.reply);

  // O que não pode ser falado sai em texto, do jeito de sempre (RF-5).
  if (hasButtons) {
    await textChannel.sendButtons(call.callerPhone, {
      bodyText: result.reply,
      buttons: result.buttons!,
      listButtonLabel: result.listButtonLabel,
      isImmediate: true,
    });
  } else {
    await textChannel.sendText(call.callerPhone, result.reply, { isImmediate: true });
  }
  return SENT_BY_MESSAGE_OUTPUT;
}

function sendToRealtime(call: ActiveCall, event: Record<string, unknown>): void {
  if (call.sideband.readyState === call.sideband.OPEN) call.sideband.send(JSON.stringify(event));
}

/** Eventos que dizem se o áudio está fluindo e se a OpenAI recusou algum comando. */
const DIAGNOSTIC_EVENTS = new Set([
  "session.created",
  "session.updated",
  "error",
  "input_audio_buffer.speech_started",
  "input_audio_buffer.speech_stopped",
  "output_audio_buffer.started",
  "output_audio_buffer.stopped",
  "response.created",
  "response.done",
]);

function isCallDebugOn(): boolean {
  return process.env.ASTRO_WHATSAPP_CALLS_DEBUG === "true";
}

/** Resumo da descrição de áudio: linhas de mídia, papel na conexão, codecs e quantos endereços. Sem credenciais da sessão. */
export function summarizeSdp(sdp: string): string {
  const lines = sdp.split(/\r?\n/);
  const pick = (prefix: string) => lines.filter((line) => line.startsWith(prefix));
  return JSON.stringify({
    media: pick("m="),
    setup: pick("a=setup:"),
    direction: lines.filter((line) => /^a=(sendrecv|sendonly|recvonly|inactive)$/.test(line)),
    codecs: pick("a=rtpmap:"),
    iceLite: lines.includes("a=ice-lite"),
    candidates: pick("a=candidate:").map((line) => line.split(" ").slice(2, 8).join(" ")),
    hasFingerprint: pick("a=fingerprint:").length > 0,
    mid: pick("a=mid:"),
    group: pick("a=group:"),
    rtcpMux: lines.includes("a=rtcp-mux"),
  });
}

async function onRealtimeEvent(call: ActiveCall, botConfig: OrganizationBotConfig, rawEvent: string): Promise<void> {
  let event: { type?: string; name?: string; call_id?: string; arguments?: string; error?: unknown; response?: { status?: string; status_details?: unknown } };
  try {
    event = JSON.parse(rawEvent);
  } catch {
    return;
  }
  if (event.type === "error") {
    console.error("[astro-bot/chamada] OpenAI recusou um comando:", JSON.stringify(event.error).slice(0, 400));
  } else if (isCallDebugOn() && event.type && DIAGNOSTIC_EVENTS.has(event.type)) {
    const detail = event.type === "response.done" ? ` status=${event.response?.status} ${JSON.stringify(event.response?.status_details ?? "").slice(0, 200)}` : "";
    console.log(`[astro-bot/chamada] evento ${event.type}${detail}`);
  }
  if (event.type !== "response.function_call_arguments.done" || event.name !== ASTRO_VOICE_TOOL_NAME) return;

  let question = "";
  try {
    question = String((JSON.parse(event.arguments ?? "{}") as { pergunta?: unknown }).pergunta ?? "").trim();
  } catch {
    question = "";
  }
  const output = question
    ? await consultAstro(call, botConfig, question).catch((consultError: unknown) => {
        console.error("[astro-bot/chamada] consulta falhou", consultError);
        return "Não consegui consultar agora. Peça para a pessoa tentar de novo ou escrever por mensagem.";
      })
    : "Não entendi o pedido. Peça para repetir.";
  sendToRealtime(call, {
    type: "conversation.item.create",
    item: { type: "function_call_output", call_id: event.call_id, output },
  });
  sendToRealtime(call, { type: "response.create" });
}

async function recordCall(call: ActiveCall, durationSeconds: number): Promise<void> {
  const minutes = Math.max(1, Math.ceil(durationSeconds / SECONDS_PER_MINUTE));
  const charge = await meter({
    organizationId: call.binding.organizationId,
    action: "astro_voice_minute",
    userId: call.binding.userId,
    quantity: { unit: "minute", amount: minutes },
    appSlug: "astro",
    description: `Astro pelo WhatsApp — chamada de voz (${minutes} min)`,
    feature: "astro.whatsapp.call",
  }).catch((chargeError: unknown) => {
    console.warn("[astro-bot/chamada] cobrança falhou", chargeError);
    return null;
  });
  await prisma.whatsappBotCommand
    .create({
      data: {
        bindingId: call.binding.id,
        organizationId: call.binding.organizationId,
        messageText: `[chamada de voz] ${durationSeconds} s`,
        responseSummary: call.questions.length > 0 ? call.questions.join(" | ").slice(0, 1000) : "Sem pedidos na chamada.",
        status: "ok",
        toolsCalled: ["chamada"],
        starsCharged: charge && charge.charged && charge.success ? charge.cost : 0,
        repliedWithVoice: true,
      },
    })
    .catch((logError: unknown) => console.warn("[astro-bot/chamada] registro falhou", logError));
}

/** Encerra dos dois lados, uma vez só (RF-7, RS-9). `terminateOnMeta: false` quando a Meta já avisou o fim. */
export async function endCall(metaCallId: string, options: { terminateOnMeta: boolean; reason: string }): Promise<void> {
  const call = activeCalls.get(metaCallId);
  if (!call || call.hasEnded) return;
  call.hasEnded = true;
  activeCalls.delete(metaCallId);
  call.timers.forEach(clearTimeout);
  const durationSeconds = Math.round((Date.now() - call.startedAt) / 1000);
  console.log(`[astro-bot/chamada] fim call=${metaCallId} motivo=${options.reason} duracao=${durationSeconds}s pedidos=${call.questions.length}`);
  try {
    call.sideband.close();
  } catch {
    // já fechado
  }
  await hangUpRealtimeCall(call.apiKey, call.realtimeCallId);
  await call.relay.close();
  if (options.terminateOnMeta) {
    await sendOfficialCallAction(call.instance.accessToken, call.instance.phoneNumberId, {
      callId: metaCallId,
      action: "terminate",
    }).catch((terminateError: unknown) =>
      console.warn("[astro-bot/chamada] encerrar na Meta falhou:", terminateError instanceof Error ? terminateError.message.slice(0, 200) : "erro"),
    );
  }
  await recordCall(call, durationSeconds);
}

async function notifyCallFailed(instance: CallInstance, callerPhone: string): Promise<void> {
  await new TrackingProviderBotChannel(instance.trackingId)
    .sendText(callerPhone, CALL_FAILED_TEXT, { isImmediate: true })
    .catch((sendError: unknown) => console.warn("[astro-bot/chamada] aviso de falha não enviado", sendError));
}

/** Atende a chamada: fecha o áudio entre Meta e OpenAI e abre o canal de controle. */
export async function answerCall(params: {
  metaCallId: string;
  sdpOffer: string;
  callerPhone: string;
  instance: CallInstance;
  binding: UserWhatsappBinding & { botConfig: OrganizationBotConfig };
}): Promise<{ answered: boolean; reason?: string }> {
  const { metaCallId, instance, binding } = params;
  const rejectCall = async (reason: string) => {
    await sendOfficialCallAction(instance.accessToken, instance.phoneNumberId, { callId: metaCallId, action: "reject" }).catch(
      () => undefined,
    );
    await notifyCallFailed(instance, params.callerPhone);
    return { answered: false, reason };
  };

  const apiKey = await resolveOpenAiKey(binding.organizationId);
  if (!apiKey) return rejectCall("no_openai_key");

  const [user, organization] = await Promise.all([
    prisma.user.findUnique({ where: { id: binding.userId }, select: { name: true } }),
    prisma.organization.findUnique({ where: { id: binding.organizationId }, select: { name: true } }),
  ]);
  const organizationName = organization?.name ?? "sua empresa";

  if (isCallDebugOn()) console.log("[astro-bot/chamada] oferta da Meta:", summarizeSdp(params.sdpOffer));
  let relay: MediaRelay;
  try {
    relay = await createMediaRelay({
      apiKey,
      metaSdpOffer: params.sdpOffer,
      sessionConfig: buildCallSessionConfig({ userFirstName: user?.name?.split(" ")[0] || "você", organizationName }),
      onStateChange: (leg, state) => {
        if (isCallDebugOn()) console.log(`[astro-bot/chamada] áudio ${leg}: ${state}`);
      },
    });
  } catch (relayError) {
    console.error("[astro-bot/chamada] não consegui montar o áudio:", relayError instanceof Error ? relayError.message.slice(0, 400) : "erro");
    return rejectCall("relay_failed");
  }
  const realtimeCall = { realtimeCallId: relay.realtimeCallId, sdpAnswer: relay.metaSdpAnswer };

  if (isCallDebugOn()) console.log("[astro-bot/chamada] resposta enviada à Meta:", summarizeSdp(realtimeCall.sdpAnswer));
  try {
    await sendOfficialCallAction(instance.accessToken, instance.phoneNumberId, {
      callId: metaCallId,
      action: "pre_accept",
      sdpAnswer: realtimeCall.sdpAnswer,
    });
    await sendOfficialCallAction(instance.accessToken, instance.phoneNumberId, {
      callId: metaCallId,
      action: "accept",
      sdpAnswer: realtimeCall.sdpAnswer,
    });
  } catch (acceptError) {
    console.error("[astro-bot/chamada] Meta recusou a resposta:", acceptError instanceof Error ? acceptError.message.slice(0, 400) : "erro");
    await hangUpRealtimeCall(apiKey, realtimeCall.realtimeCallId);
    await relay.close();
    return rejectCall("meta_rejected_answer");
  }

  const sideband = openRealtimeSideband(apiKey, realtimeCall.realtimeCallId);
  const call: ActiveCall = {
    metaCallId,
    realtimeCallId: realtimeCall.realtimeCallId,
    apiKey,
    instance,
    binding,
    callerPhone: params.callerPhone,
    startedAt: Date.now(),
    sideband,
    relay,
    timers: [],
    questions: [],
    hasEnded: false,
  };
  activeCalls.set(metaCallId, call);

  sideband.on("open", () => {
    if (isCallDebugOn()) console.log("[astro-bot/chamada] canal de controle aberto");
    sendToRealtime(call, { type: "response.create", response: { instructions: buildGreetingInstructions(organizationName) } });
  });
  sideband.on("message", (rawEvent) => {
    void onRealtimeEvent(call, binding.botConfig, rawEvent.toString());
  });
  // Sem o canal de controle ninguém acompanha a chamada: encerra (RS-9).
  sideband.on("close", () => void endCall(metaCallId, { terminateOnMeta: true, reason: "controle_fechado" }));
  sideband.on("error", (sidebandError) => {
    console.error("[astro-bot/chamada] canal de controle falhou:", sidebandError.message.slice(0, 200));
    void endCall(metaCallId, { terminateOnMeta: true, reason: "controle_erro" });
  });

  call.timers.push(
    setTimeout(() => {
      sendToRealtime(call, {
        type: "response.create",
        response: { instructions: "Avise em uma frase que a ligação vai encerrar em um minuto e pergunte se falta algo." },
      });
    }, CALL_WARNING_MS),
    setTimeout(() => void endCall(metaCallId, { terminateOnMeta: true, reason: "limite_de_tempo" }), MAX_CALL_MS),
  );
  console.log(`[astro-bot/chamada] atendida call=${metaCallId} binding=${binding.id}`);
  return { answered: true };
}
