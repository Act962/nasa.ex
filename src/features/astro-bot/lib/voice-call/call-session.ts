import "server-only";
import type WebSocket from "ws";
import type { OrganizationBotConfig, UserWhatsappBinding } from "@/generated/prisma/client";
import type { BotCommandResult } from "../types";
import prisma from "@/lib/prisma";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import { meter, recordUsageEvent } from "@/features/stars/lib/metering";
import { hasStarsCredit } from "@/features/stars/lib/stars-credit";
import { ASTRO_VOICE_TOOL_NAME } from "@/features/astro/server/voice/build-voice-session-config";
import { buildKnowledgeBlock, loadKnowledgeDocuments } from "@/features/astro/server/knowledge/load-knowledge";
import { buildMemoriesBlock, loadActiveMemories } from "@/features/astro/server/knowledge/load-memories";
import { sendOfficialCallAction } from "@/http/whats-oficial/calls";
import { clearGuidedSlot } from "@/features/astro/actions/guided-slots";
import { rememberOpenQuestion } from "../open-question";
import { handleBotCommand } from "../router";
import { isTrafegoOrganization } from "../stars-billing";
import { TrackingProviderBotChannel } from "../tracking-provider-channel";
import { canBeSpoken, toSpeakableText } from "../voice/speakable-text";
import {
  CALL_WARNING_MS,
  LISTENING_TURN_DETECTION,
  WAITING_PHRASES,
  MAX_CALL_MS,
  buildCallSessionConfig,
  buildGreetingInstructions,
} from "./call-config";
import { saveCallInLeadChat, type CallTranscriptLine } from "./call-record";
import { applyInterestTagsFromCall } from "@/features/tracking-chat-ai/lib/tag-from-transcript";
import { createMediaRelay, type MediaRelay } from "./media-relay";
import { hangUpRealtimeCall, openRealtimeSideband } from "./realtime-call";

/**
 * Uma chamada de voz do Astro em andamento (spec 0086).
 *
 * O canal de controle vive na memória deste processo enquanto a chamada dura:
 * um deploy no meio derruba a chamada. Aceito na prova de conceito.
 */

const MINUTE_MS = 60_000;
const CLIENT_CALLER_PREFIX = "lead:";
const CALL_ACTION = "astro_whatsapp_call_minute";
const CALL_FAILED_TEXT = "Não consegui atender por voz agora. Me escreva por aqui.";
export const CLIENT_TEXT_ONLY_MESSAGE = "No momento atendemos só por mensagem. Pode escrever por aqui.";
const NO_CREDIT_TEXT =
  "Sua empresa está sem crédito (Stars) para atender por voz. Me escreva por aqui, que eu respondo por mensagem.";
/** Custo estimado da voz em tempo real por minuto, em dólar, para o registro de custos (spec 0086, tabela de custos). */
const VOICE_COST_USD_PER_MINUTE: Record<string, number> = { "gpt-realtime-mini": 0.027, "gpt-realtime": 0.09 };
const DEFAULT_VOICE_COST_USD_PER_MINUTE = 0.027;
const GOODBYE_BEFORE_HANGUP_MS = 8000;
const TRANSCRIPT_SAVE_LIMIT = 60_000;
/** A voz em tempo real cobra o prompt a cada resposta: o conhecimento da empresa entra resumido. */
const MAX_COMPANY_KNOWLEDGE_CHARS = 6000;
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
  /** Membro da equipe que ligou. `null` quando quem ligou é um cliente (spec 0087, Parte C). */
  binding: UserWhatsappBinding | null;
  organizationId: string;
  /** Identifica quem ligou para o limite de uma chamada por vez: vínculo do membro ou lead do cliente. */
  callerKey: string;
  /** Chamada de cliente: executa as ferramentas do atendimento, presas ao lead dele. */
  client: ClientCallPersona | null;
  callerPhone: string;
  callerName: string | null;
  startedAt: number;
  sideband: WebSocket;
  relay: MediaRelay;
  timers: NodeJS.Timeout[];
  questions: string[];
  hasEnded: boolean;
  /** Empresa com chave própria da OpenAI paga a voz direto ao provedor: registra o custo, não cobra Stars. */
  usesOwnKey: boolean;
  isBillingExempt: boolean;
  voiceModelId: string;
  starsCharged: number;
  /** Linha do registro de comandos, criada ao atender e atualizada durante a chamada. */
  commandLogId: string | null;
  transcript: TranscriptLine[];
  lastConsult: { key: string; at: number; output: string } | null;
  /** Pergunta do roteiro feita em voz e ainda sem resposta, com as opções oferecidas. */
  pendingQuestion: { options: string[] } | null;
  /** Falso enquanto a saudação toca: nesse trecho a escuta fica desligada. */
  isListening: boolean;
  /** Há uma fala do Astro em curso: uma nova só é pedida quando ela terminar. */
  isResponding: boolean;
  /** Ferramenta rodando: a resposta espera o resultado dela. */
  isRunningTool: boolean;
  /** A pessoa terminou de falar enquanto o Astro falava ou consultava: responder assim que der. */
  hasPendingTurn: boolean;
  /** O Astro já disse algo na resposta que chamou a ferramenta ("um instante"): não repete a frase de espera. */
  hasSpokenInResponse: boolean;
  shouldSayWaitingPhrase: boolean;
  /**
   * Até quando o áudio do Astro deve estar tocando do outro lado: o que o microfone pega nesse trecho é
   * eco ou ruído. É uma estimativa pelo tamanho da fala, porque o aviso de "terminou de tocar" da OpenAI
   * nem sempre chega (na chamada de 10/10/2026 não chegou, e o Astro ficou surdo até o fim).
   */
  speechEndsAt: number;
  speechStartedAt: number;
  /** Vale só entre o início do áudio e a chegada do texto da fala. */
  provisionalSpeechEndsAt: number;
  /** A escuta fica fechada enquanto o Astro fala: aberta, a OpenAI apaga o áudio em andamento a qualquer som. */
  isMicOpen: boolean;
  micTimer: NodeJS.Timeout | null;
  /** Trechos de áudio descartados (eco, ruído): a transcrição deles não entra no registro da chamada. */
  discardedItemIds: Set<string>;
}

type TranscriptLine = CallTranscriptLine;

/** Persona do cliente na chamada: sessão de voz e ferramentas já montadas para o lead que ligou. */
export interface ClientCallPersona {
  organizationId: string;
  callerKey: string;
  callerName: string | null;
  greeting: string;
  sessionConfig: Record<string, unknown> & { model: string };
  runTool: (toolName: string, rawArguments: string) => Promise<string>;
}

function addTranscriptLine(call: ActiveCall, speaker: TranscriptLine["speaker"], text: string): void {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (cleanText) call.transcript.push({ speaker, text: cleanText, at: Date.now() });
}

const SPEAKER_LABEL: Record<TranscriptLine["speaker"], string> = { pessoa: "Pessoa", astro: "Astro", sistema: "•" };

/** Transcrição em texto corrido, com a hora de cada fala, para auditoria (spec 0087, Parte A). */
function renderTranscript(call: ActiveCall, isInterrupted: boolean): string {
  const lines = call.transcript.map((line) => {
    const time = new Date(line.at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `[${time}] ${SPEAKER_LABEL[line.speaker]}: ${line.text}`;
  });
  if (isInterrupted) lines.push("• Chamada interrompida.");
  return lines.join("\n").slice(0, TRANSCRIPT_SAVE_LIMIT) || "Sem falas registradas.";
}

async function saveCallLog(call: ActiveCall, params: { durationSeconds: number; isFinal: boolean; isInterrupted: boolean }): Promise<void> {
  // A ligação mora na conversa do chat e na jornada do lead (o registro do Astro abaixo guarda o custo e o resumo).
  await saveCallInLeadChat({
    trackingId: call.instance.trackingId,
    metaCallId: call.metaCallId,
    callerPhone: call.callerPhone,
    callerName: call.callerName,
    startedAt: call.startedAt,
    durationSeconds: params.durationSeconds,
    transcript: call.transcript,
    isFinal: params.isFinal,
    isInterrupted: params.isInterrupted,
  });
  const data = {
    messageText: `[chamada de voz] ${params.durationSeconds} s${params.isFinal ? "" : " (em andamento)"}`,
    responseSummary: renderTranscript(call, params.isInterrupted),
    starsCharged: call.starsCharged,
  };
  // O registro de comandos é do Astro da equipe; chamada de cliente fica só na conversa dele.
  const binding = call.binding;
  if (!binding) return;
  try {
    if (call.commandLogId) {
      await prisma.whatsappBotCommand.update({ where: { id: call.commandLogId }, data });
      return;
    }
    const created = await prisma.whatsappBotCommand.create({
      data: {
        ...data,
        bindingId: binding.id,
        organizationId: binding.organizationId,
        status: "ok",
        toolsCalled: ["chamada"],
        repliedWithVoice: true,
      },
      select: { id: true },
    });
    call.commandLogId = created.id;
  } catch (logError) {
    console.warn("[astro-bot/chamada] registro falhou", logError);
  }
}

/**
 * Cobra um minuto de chamada e registra o custo em dinheiro, ligado ao número (spec 0087, Parte F).
 * Devolve `false` quando a empresa ficou sem crédito: a chamada deve terminar.
 */
async function chargeCallMinute(call: ActiveCall): Promise<boolean> {
  const providerCostUsd = VOICE_COST_USD_PER_MINUTE[call.voiceModelId] ?? DEFAULT_VOICE_COST_USD_PER_MINUTE;
  const usage = {
    organizationId: call.organizationId,
    userId: call.binding?.userId,
    appSlug: "astro",
    feature: "astro.whatsapp.call",
    trackingId: call.instance.trackingId,
    sessionId: call.metaCallId,
  };
  if (call.usesOwnKey || call.isBillingExempt) {
    void recordUsageEvent({
      ...usage,
      kind: "REALTIME",
      action: CALL_ACTION,
      provider: "openai",
      modelId: call.voiceModelId,
      usingCustomKey: call.usesOwnKey,
      quantity: 1,
      quantityUnit: "minute",
      providerCostUsd,
    });
    return true;
  }
  try {
    const charge = await meter({
      ...usage,
      action: CALL_ACTION,
      quantity: { unit: "minute", amount: 1 },
      description: "Astro pelo WhatsApp — chamada de voz (1 min)",
      cost: { kind: "REALTIME", provider: "openai", modelId: call.voiceModelId, providerCostUsd },
    });
    if (charge.charged && !charge.success) return false;
    if (charge.charged) call.starsCharged += charge.cost;
    return true;
  } catch (chargeError) {
    // Falha de cobrança não derruba a chamada: fica no log para acerto.
    console.warn("[astro-bot/chamada] cobrança do minuto falhou", chargeError);
    return true;
  }
}

const activeCalls = new Map<string, ActiveCall>();

export function hasActiveCallFor(callerKey: string): boolean {
  return [...activeCalls.values()].some((call) => call.callerKey === callerKey && !call.hasEnded);
}

export function countActiveCallsFor(organizationId: string): number {
  return [...activeCalls.values()].filter((call) => call.organizationId === organizationId && !call.hasEnded).length;
}

/** O que nunca é falado nem resumido em voz: dinheiro, links e códigos (spec 0087, RF-11). */
const MESSAGE_ONLY_CONTENT = /https?:\/\/|\bwww\.|\bpix\b|copia e cola|\bsenha\b|\bc[oó]digo\b|\btoken\b|\bpagamento\b|\bcobran[cç]a\b|000201\d{6,}/i;
const MAX_SPOKEN_OPTIONS = 5;
const MAX_TEXT_FOR_SPOKEN_SUMMARY = 1500;
const REPEATED_QUESTION_WINDOW_MS = 20_000;

function normalizeQuestion(question: string): string {
  return question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Roda o pedido pelo mesmo caminho da mensagem de texto: permissões, consultas em código e cobrança (RF-4).
 * O que volta para a voz depende do conteúdo (spec 0087, Parte B):
 *  - resposta curta: é falada;
 *  - pergunta com poucas opções: o Astro pergunta falando e a resposta falada volta por aqui;
 *  - lista ou resposta longa: vai por mensagem e o Astro resume os números em voz;
 *  - dinheiro, link ou código: só por mensagem.
 */
async function consultAstro(call: ActiveCall, botConfig: OrganizationBotConfig, question: string): Promise<string> {
  const binding = call.binding;
  if (!binding) return "Não consegui consultar agora.";
  // A mesma pergunta em seguida não consulta de novo (RF-12).
  const questionKey = normalizeQuestion(question);
  if (!call.pendingQuestion && call.lastConsult && call.lastConsult.key === questionKey && Date.now() - call.lastConsult.at < REPEATED_QUESTION_WINDOW_MS) {
    return call.lastConsult.output;
  }
  // Há uma pergunta do roteiro em aberto: o que chega é a resposta dela. O modelo de voz costuma mandar a
  // frase inteira de novo ("adicionar o lead no funil Suporte"), e isso recomeçava o roteiro; aqui a
  // resposta é reduzida à opção escolhida.
  const pendingQuestion = call.pendingQuestion;
  call.pendingQuestion = null;
  const chosenOption = pendingQuestion
    ? pendingQuestion.options
        .filter((option) => questionKey.includes(normalizeQuestion(option)))
        .sort((first, second) => second.length - first.length)[0]
    : undefined;
  const commandText = chosenOption ?? question;

  call.questions.push(commandText);
  addTranscriptLine(call, "sistema", pendingQuestion ? `Resposta ao roteiro: ${commandText}` : `Astro consultou: ${commandText}`);
  const textChannel = new TrackingProviderBotChannel(call.instance.trackingId);
  const result = await handleBotCommand(
    { binding, botConfig, channel: textChannel, trackingId: call.instance.trackingId },
    commandText,
  );
  const output = await toVoiceOutput(call, textChannel, result);
  call.lastConsult = { key: questionKey, at: Date.now(), output };
  return output;
}

async function toVoiceOutput(call: ActiveCall, textChannel: TrackingProviderBotChannel, result: BotCommandResult): Promise<string> {
  const spokenOptions = (result.buttons ?? []).filter((button) => !button.interactiveOnly);
  const hasButtons = Boolean(result.buttons && result.buttons.length > 0);
  const isMessageOnly = MESSAGE_ONLY_CONTENT.test(result.reply);

  // Só é pergunta o que espera resposta: botão de resposta do roteiro ou frase terminada em "?".
  // Cartão de ação concluída também tem botões (abrir, menu) e não pode ser lido como pergunta.
  const hasAnswerButtons = (result.buttons ?? []).some((button) => button.id.startsWith("ans:"));
  const isQuestion = hasAnswerButtons || result.reply.trim().endsWith("?");

  if (result.status === "ok" && !isQuestion && canBeSpoken(result.reply)) {
    return `Resultado da ferramenta, para dizer à pessoa: ${toSpeakableText(result.reply)}`;
  }

  // Pergunta do roteiro: falada, sem mensagem no meio da ligação. A ação ainda não foi feita.
  if (result.status === "ok" && isQuestion && !isMessageOnly) {
    const optionNames = spokenOptions.map((button) => button.text);
    call.pendingQuestion = { options: optionNames };
    addTranscriptLine(
      call,
      "sistema",
      `Astro perguntou: ${result.reply.slice(0, 200)}${optionNames.length > 0 ? ` (${optionNames.join("; ")})` : ""}`,
    );
    const spokenQuestion = toSpeakableText(result.reply);
    const optionsHint =
      optionNames.length === 0
        ? ""
        : optionNames.length <= MAX_SPOKEN_OPTIONS
          ? ` As opções são: ${optionNames.join("; ")}.`
          : ` São ${optionNames.length} opções; diga as primeiras: ${optionNames.slice(0, 3).join("; ")}, e pergunte se é uma delas ou outra.`;
    return (
      `A AÇÃO AINDA NÃO FOI FEITA: falta uma resposta. Pergunte à pessoa, em voz alta: "${spokenQuestion}"${optionsHint} ` +
      "Quando ela responder, chame a ferramenta de novo passando SOMENTE a resposta dela, sem repetir o pedido. Não escolha por ela e não diga que algo foi feito."
    );
  }

  if (hasButtons) {
    const sent = await textChannel.sendButtons(call.callerPhone, {
      bodyText: result.reply,
      buttons: result.buttons!,
      listButtonLabel: result.listButtonLabel,
      isImmediate: true,
    });
    // Sem registrar a pergunta enviada, o clique nela era tratado como botão de pergunta antiga.
    if (call.binding) rememberOpenQuestion(call.binding.id, sent.messageId, result.buttons);
  } else {
    await textChannel.sendText(call.callerPhone, result.reply, { isImmediate: true });
  }
  addTranscriptLine(call, "sistema", `Astro enviou por mensagem: ${result.reply.slice(0, 200)}`);
  if (isMessageOnly || result.status !== "ok") return SENT_BY_MESSAGE_OUTPUT;

  // Lista ou resposta longa: os detalhes foram por mensagem, mas os números principais são ditos na ligação.
  return (
    "A resposta completa foi enviada por mensagem. Diga agora, em uma ou duas frases, os números e o resultado principal " +
    "desta resposta, sem ler a lista inteira e sem acrescentar nada que não esteja nela, e avise que os detalhes estão na mensagem: " +
    result.reply.slice(0, MAX_TEXT_FOR_SPOKEN_SUMMARY)
  );
}

function sendToRealtime(call: ActiveCall, event: Record<string, unknown>): void {
  if (call.sideband.readyState === call.sideband.OPEN) call.sideband.send(JSON.stringify(event));
}

/** Enquanto o texto da fala não chega, supõe-se que ela dura isto. */
const PROVISIONAL_SPEAKING_MS = 12_000;
const SPOKEN_CHARS_PER_SECOND = 15;
/** Folga depois do fim estimado, para o eco do final da frase. */
const SPEAKING_TAIL_MS = 700;

const STALE_SPEECH_START_MS = 3000;

function isAstroSpeaking(call: ActiveCall): boolean {
  return Date.now() < Math.max(call.speechEndsAt + SPEAKING_TAIL_MS, call.provisionalSpeechEndsAt);
}

function closeMic(call: ActiveCall): void {
  if (!call.isMicOpen) return;
  call.isMicOpen = false;
  sendToRealtime(call, { type: "session.update", session: { type: "realtime", audio: { input: { turn_detection: null } } } });
}

/** Abre a escuta limpa: o que o microfone pegou enquanto o Astro falava (eco, ambiente) é jogado fora. */
function openMic(call: ActiveCall): void {
  if (call.micTimer) clearTimeout(call.micTimer);
  call.micTimer = null;
  if (call.hasEnded || call.isMicOpen) return;
  call.isMicOpen = true;
  sendToRealtime(call, { type: "input_audio_buffer.clear" });
  sendToRealtime(call, {
    type: "session.update",
    session: { type: "realtime", audio: { input: { turn_detection: LISTENING_TURN_DETECTION } } },
  });
}

/** Garante a reabertura mesmo se o aviso de fim de áudio da OpenAI não chegar. */
function scheduleMicOpen(call: ActiveCall, delayMs: number): void {
  if (call.micTimer) clearTimeout(call.micTimer);
  call.micTimer = setTimeout(() => openMic(call), Math.max(0, delayMs));
}

/** Pede a próxima fala. Com uma fala em curso ou uma consulta rodando, fica para logo depois. */
function requestResponse(call: ActiveCall): void {
  if (call.isResponding || call.isRunningTool) {
    call.hasPendingTurn = true;
    return;
  }
  call.hasPendingTurn = false;
  call.isResponding = true;
  sendToRealtime(call, { type: "response.create" });
}

/** Frase de espera fora da conversa: não entra no histórico do modelo nem muda o assunto. */
function sayWaitingPhrase(call: ActiveCall): void {
  const phrase = WAITING_PHRASES[Math.floor(Math.random() * WAITING_PHRASES.length)];
  call.isResponding = true;
  sendToRealtime(call, {
    type: "response.create",
    response: { conversation: "none", tool_choice: "none", instructions: `Diga exatamente, em tom natural e sem acrescentar nada: "${phrase}"` },
  });
}

/** Eventos que dizem se o áudio está fluindo e se a OpenAI recusou algum comando. */
const DIAGNOSTIC_EVENTS = new Set([
  "session.created",
  "session.updated",
  "error",
  "input_audio_buffer.speech_started",
  "input_audio_buffer.speech_stopped",
  "input_audio_buffer.committed",
  "output_audio_buffer.started",
  "output_audio_buffer.stopped",
  "output_audio_buffer.cleared",
  "conversation.item.truncated",
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

async function onRealtimeEvent(call: ActiveCall, botConfig: OrganizationBotConfig | null, rawEvent: string): Promise<void> {
  let event: { type?: string; name?: string; call_id?: string; item_id?: string; arguments?: string; transcript?: string; error?: unknown; response?: { status?: string; status_details?: unknown } };
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
  if (event.type === "response.created") {
    call.isResponding = true;
    call.hasSpokenInResponse = false;
    return;
  }
  if (event.type === "response.done") {
    call.isResponding = false;
    // Saudação gerada: a partir daqui o Astro escuta e responde. A escuta abre quando o áudio dela terminar.
    if (!call.isListening) {
      call.isListening = true;
      if (!call.micTimer) scheduleMicOpen(call, PROVISIONAL_SPEAKING_MS);
      return;
    }
    if (call.isRunningTool) {
      if (call.shouldSayWaitingPhrase) {
        call.shouldSayWaitingPhrase = false;
        sayWaitingPhrase(call);
      }
      return;
    }
    if (call.hasPendingTurn) requestResponse(call);
    return;
  }
  // Uma pessoa por vez: enquanto o Astro fala, o microfone pega o eco da própria voz dele e o barulho
  // do ambiente. Esse trecho é descartado, e a escuta recomeça limpa quando ele termina.
  if (event.type === "output_audio_buffer.started") {
    call.speechStartedAt = Date.now();
    call.provisionalSpeechEndsAt = Date.now() + PROVISIONAL_SPEAKING_MS;
    closeMic(call);
    scheduleMicOpen(call, PROVISIONAL_SPEAKING_MS);
    return;
  }
  if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") {
    call.speechEndsAt = 0;
    call.provisionalSpeechEndsAt = 0;
    // Outra fala a caminho (resposta depois da frase de espera): a escuta continua fechada até ela.
    if (call.isResponding) scheduleMicOpen(call, PROVISIONAL_SPEAKING_MS);
    else openMic(call);
    return;
  }
  // A pessoa terminou de falar: é a vez do Astro.
  if (event.type === "input_audio_buffer.committed") {
    if (!call.isListening || isAstroSpeaking(call)) {
      if (event.item_id) {
        call.discardedItemIds.add(event.item_id);
        sendToRealtime(call, { type: "conversation.item.delete", item_id: event.item_id });
      }
      return;
    }
    requestResponse(call);
    return;
  }
  // Falas em texto, para a transcrição da chamada (spec 0087, RF-1).
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    if (event.item_id && call.discardedItemIds.has(event.item_id)) return;
    addTranscriptLine(call, "pessoa", event.transcript ?? "");
    return;
  }
  if (event.type === "response.output_audio_transcript.done") {
    call.hasSpokenInResponse = true;
    // Com o texto em mãos, a duração da fala deixa de ser um chute. Uma fala logo depois da outra soma.
    const spokenMs = ((event.transcript ?? "").length / SPOKEN_CHARS_PER_SECOND) * 1000;
    const startsAt = Math.max(call.speechEndsAt, call.speechStartedAt, Date.now() - STALE_SPEECH_START_MS);
    call.speechEndsAt = startsAt + spokenMs;
    call.provisionalSpeechEndsAt = 0;
    scheduleMicOpen(call, call.speechEndsAt + SPEAKING_TAIL_MS - Date.now());
    addTranscriptLine(call, "astro", event.transcript ?? "");
    return;
  }
  if (event.type !== "response.function_call_arguments.done" || !event.name) return;

  // A consulta pode levar alguns segundos: sem uma frase antes, a pessoa fica no silêncio.
  call.isRunningTool = true;
  call.shouldSayWaitingPhrase = !call.hasSpokenInResponse;
  call.relay.setTypingSound(true);
  const finishTool = (output: string) => {
    call.relay.setTypingSound(false);
    call.isRunningTool = false;
    call.shouldSayWaitingPhrase = false;
    sendToRealtime(call, { type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output } });
    requestResponse(call);
  };

  // Cliente: a ferramenta pedida é uma das do atendimento, já presa ao lead que ligou.
  if (call.client) {
    addTranscriptLine(call, "sistema", `Astro usou: ${event.name}`);
    const clientOutput = await call.client.runTool(event.name, event.arguments ?? "{}").catch((toolError: unknown) => {
      console.error("[astro-bot/chamada] ferramenta do cliente falhou", toolError);
      return "Não consegui fazer isso agora. Ofereça um atendente.";
    });
    finishTool(clientOutput);
    return;
  }
  if (event.name !== ASTRO_VOICE_TOOL_NAME || !botConfig) {
    finishTool("Ferramenta indisponível nesta ligação.");
    return;
  }

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
  finishTool(output);
}

/** Encerra dos dois lados, uma vez só (RF-7, RS-9). `terminateOnMeta: false` quando a Meta já avisou o fim. */
export async function endCall(metaCallId: string, options: { terminateOnMeta: boolean; reason: string }): Promise<void> {
  const call = activeCalls.get(metaCallId);
  if (!call || call.hasEnded) return;
  call.hasEnded = true;
  activeCalls.delete(metaCallId);
  call.timers.forEach(clearTimeout);
  if (call.micTimer) clearTimeout(call.micTimer);
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
  // Roteiro que ficou pela metade na ligação não continua no texto: sem isto, a próxima mensagem
  // escrita era lida como resposta à pergunta que ficou em aberto na chamada.
  if (call.pendingQuestion && call.binding) clearGuidedSlot(`whatsapp:${call.binding.id}`);
  await saveCallLog(call, { durationSeconds, isFinal: true, isInterrupted: options.reason.startsWith("controle") });
  // Ligação de cliente: o interesse dito na conversa vira tag, que é o que dispara os fluxos da empresa.
  if (call.client && call.callerKey.startsWith(CLIENT_CALLER_PREFIX)) {
    await applyInterestTagsFromCall({
      organizationId: call.organizationId,
      trackingId: call.instance.trackingId,
      leadId: call.callerKey.slice(CLIENT_CALLER_PREFIX.length),
      transcript: call.transcript,
    })
      .then((tagging) => {
        if (tagging.applied.length > 0) console.log(`[astro-bot/chamada] tags pela ligação: ${tagging.applied.join(", ")}`);
      })
      .catch((taggingError: unknown) =>
        console.warn("[astro-bot/chamada] tags pela ligação falharam:", taggingError instanceof Error ? taggingError.message.slice(0, 160) : "erro"),
      );
  }
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
  /** Membro da equipe que ligou; ausente quando é cliente. */
  binding?: UserWhatsappBinding & { botConfig: OrganizationBotConfig };
  /** Cliente que ligou; ausente quando é a equipe. */
  client?: ClientCallPersona;
}): Promise<{ answered: boolean; reason?: string }> {
  const { metaCallId, instance } = params;
  const binding = params.binding ?? null;
  const client = params.client ?? null;
  const organizationId = binding?.organizationId ?? client?.organizationId;
  if (!organizationId) return { answered: false, reason: "no_caller" };
  const rejectCall = async (reason: string) => {
    await sendOfficialCallAction(instance.accessToken, instance.phoneNumberId, { callId: metaCallId, action: "reject" }).catch(
      () => undefined,
    );
    await notifyCallFailed(instance, params.callerPhone);
    return { answered: false, reason };
  };

  const organizationKey = (await loadOrganizationKeys(organizationId)).openai?.apiKey ?? null;
  const apiKey = organizationKey ?? envKeyFor("openai") ?? null;
  if (!apiKey) return rejectCall("no_openai_key");

  // Sem crédito não há chamada (spec 0087, RF-28). Quem usa chave própria paga a voz direto ao provedor.
  const isBillingExempt = await isTrafegoOrganization(organizationId);
  if (!organizationKey && !isBillingExempt && !(await hasStarsCredit(organizationId))) {
    await sendOfficialCallAction(instance.accessToken, instance.phoneNumberId, { callId: metaCallId, action: "reject" }).catch(
      () => undefined,
    );
    // Ao cliente não se fala de crédito da empresa: ele só sabe que o atendimento é por mensagem.
    await new TrackingProviderBotChannel(instance.trackingId)
      .sendText(params.callerPhone, client ? CLIENT_TEXT_ONLY_MESSAGE : NO_CREDIT_TEXT, { isImmediate: true })
      .catch(() => undefined);
    return { answered: false, reason: "no_credit" };
  }

  const [user, organization] = await Promise.all([
    binding ? prisma.user.findUnique({ where: { id: binding.userId }, select: { name: true } }) : null,
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ]);
  const organizationName = organization?.name ?? "sua empresa";

  if (isCallDebugOn()) console.log("[astro-bot/chamada] oferta da Meta:", summarizeSdp(params.sdpOffer));
  // O que a empresa ensinou ao Astro (Auto Inteligência) vale na ligação como vale no texto.
  const [knowledgeDocuments, memories] = await Promise.all([
    client ? [] : loadKnowledgeDocuments({ organizationId }).catch(() => []),
    client ? [] : loadActiveMemories({ organizationId }).catch(() => []),
  ]);
  const sessionConfig = client?.sessionConfig ?? buildCallSessionConfig({
    userFirstName: user?.name?.split(" ")[0] || "você",
    organizationName,
    companyKnowledge: (buildMemoriesBlock(memories) + buildKnowledgeBlock(knowledgeDocuments)).slice(0, MAX_COMPANY_KNOWLEDGE_CHARS),
  });
  let relay: MediaRelay;
  try {
    relay = await createMediaRelay({
      apiKey,
      metaSdpOffer: params.sdpOffer,
      sessionConfig,
      onStateChange: (leg, state) => {
        if (isCallDebugOn()) console.log(`[astro-bot/chamada] áudio ${leg}: ${state}`);
      },
      hasTypingSound: process.env.ASTRO_WHATSAPP_CALLS_TYPING_SOUND === "true",
      onPacketCount: isCallDebugOn()
        ? (count) => console.log(`[astro-bot/chamada] pacotes de áudio: de quem ligou=${count.fromCaller} do Astro=${count.fromAstro}`)
        : undefined,
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
    organizationId,
    callerKey: binding?.id ?? client?.callerKey ?? params.callerPhone,
    client,
    callerPhone: params.callerPhone,
    callerName: user?.name ?? client?.callerName ?? null,
    startedAt: Date.now(),
    sideband,
    relay,
    timers: [],
    questions: [],
    hasEnded: false,
    usesOwnKey: Boolean(organizationKey),
    isBillingExempt,
    voiceModelId: sessionConfig.model,
    starsCharged: 0,
    commandLogId: null,
    transcript: [],
    lastConsult: null,
    pendingQuestion: null,
    isListening: false,
    isResponding: false,
    isRunningTool: false,
    hasPendingTurn: false,
    hasSpokenInResponse: false,
    shouldSayWaitingPhrase: false,
    speechEndsAt: 0,
    speechStartedAt: 0,
    provisionalSpeechEndsAt: 0,
    discardedItemIds: new Set(),
    isMicOpen: false,
    micTimer: null,
  };
  activeCalls.set(metaCallId, call);

  // Cobrança minuto a minuto: o primeiro ao atender, os seguintes a cada minuto. Sem crédito, o Astro
  // se despede e a chamada termina. A cada minuto a transcrição parcial é salva (RF-5).
  const endForNoCredit = () => {
    sendToRealtime(call, {
      type: "response.create",
      response: { instructions: "Avise em uma frase que o crédito da empresa acabou, que a ligação vai encerrar e que a pessoa pode continuar por mensagem." },
    });
    call.timers.push(setTimeout(() => void endCall(metaCallId, { terminateOnMeta: true, reason: "sem_credito" }), GOODBYE_BEFORE_HANGUP_MS));
  };
  void chargeCallMinute(call).then((hasCredit) => {
    if (!hasCredit) endForNoCredit();
  });
  const minuteTimer = setInterval(() => {
    if (call.hasEnded) return clearInterval(minuteTimer);
    void saveCallLog(call, { durationSeconds: Math.round((Date.now() - call.startedAt) / 1000), isFinal: false, isInterrupted: false });
    void chargeCallMinute(call).then((hasCredit) => {
      if (!hasCredit) {
        clearInterval(minuteTimer);
        endForNoCredit();
      }
    });
  }, MINUTE_MS);
  call.timers.push(minuteTimer);

  sideband.on("open", () => {
    if (isCallDebugOn()) console.log("[astro-bot/chamada] canal de controle aberto");
    sendToRealtime(call, {
      type: "response.create",
      response: { instructions: client?.greeting ?? buildGreetingInstructions(organizationName) },
    });
  });
  sideband.on("message", (rawEvent) => {
    void onRealtimeEvent(call, binding?.botConfig ?? null, rawEvent.toString());
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
  console.log(`[astro-bot/chamada] atendida call=${metaCallId} quem=${binding ? `equipe:${binding.id}` : call.callerKey}`);
  return { answered: true };
}
