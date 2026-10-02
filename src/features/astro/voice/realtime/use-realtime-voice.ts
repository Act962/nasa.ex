"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAstroModelPreference } from "@/features/astro/composer/use-astro-model-preference";

/** Chamada de voz em tempo real com o ASTRO via WebRTC direto na OpenAI (spec 0054). */

export type VoiceCallStatus = "idle" | "connecting" | "listening" | "speaking" | "consulting" | "ending";

export type VoiceCallErrorCode =
  | "UNSUPPORTED"
  | "MIC_DENIED"
  | "CHOOSE_AI"
  | "NO_BALANCE"
  | "STARS_SUSPENDED"
  | "RATE_LIMITED"
  | "OWN_KEY_REJECTED"
  | "VOICE_DISABLED"
  | "CONNECTION_FAILED"
  | string;

export interface VoiceTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface UseRealtimeVoiceOptions {
  /** Envia a pergunta ao ASTRO de texto e devolve a resposta final (ferramenta `consultar_astro`). */
  askAstro: (question: string) => Promise<string>;
  onTurn: (turn: VoiceTurn) => void;
  onError: (code: VoiceCallErrorCode, message: string) => void;
  onCallEnded?: () => void;
}

interface RealtimeServerEvent {
  type: string;
  item_id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  transcript?: string;
  response_id?: string;
  response?: { id?: string; output?: Array<{ type?: string }>; usage?: Record<string, unknown> };
  error?: { message?: string };
}

const SESSION_ENDPOINT = "/api/astro/voice/session";
const HEARTBEAT_ENDPOINT = "/api/astro/voice/heartbeat";
const USAGE_ENDPOINT = "/api/astro/voice/usage";
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const HEARTBEAT_INTERVAL_MS = 60_000;
const SILENCE_LIMIT_MS = 2 * 60_000;
const FAREWELL_LEAD_MS = 20_000;
const FAREWELL_HANGUP_MS = 7_000;
const ASK_ASTRO_TIMEOUT_MS = 30_000;
const TOOL_NAME = "consultar_astro";

function isWebRtcSupported(): boolean {
  return typeof window !== "undefined" && "RTCPeerConnection" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))]);
}

export function useRealtimeVoice({ askAstro, onTurn, onError, onCallEnded }: UseRealtimeVoiceOptions) {
  const [status, setStatus] = useState<VoiceCallStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIdsRef = useRef<number[]>([]);
  const callTokenRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const isEndingRef = useRef(false);

  // Falas do turno atual: só viram balão quando sabemos se o turno foi para o ASTRO de texto.
  const pendingUserTextRef = useRef<string | null>(null);
  const turnResolvedRef = useRef(false);
  const turnUsedToolRef = useRef(false);
  const heldAssistantTurnRef = useRef<VoiceTurn | null>(null);
  const assistantTranscriptsRef = useRef(new Map<string, { itemId: string; text: string }>());
  const suppressNextAssistantRef = useRef(false);

  const callbacksRef = useRef({ askAstro, onTurn, onError, onCallEnded });
  useEffect(() => {
    callbacksRef.current = { askAstro, onTurn, onError, onCallEnded };
  });

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const dataChannel = dataChannelRef.current;
    if (dataChannel?.readyState === "open") dataChannel.send(JSON.stringify(event));
  }, []);

  const endCall = useCallback(() => {
    if (!peerConnectionRef.current && !micStreamRef.current) return;
    timerIdsRef.current.forEach((timerId) => window.clearInterval(timerId));
    timerIdsRef.current = [];
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    peerConnectionRef.current = null;
    dataChannelRef.current = null;
    micStreamRef.current = null;
    callTokenRef.current = null;
    if (heldAssistantTurnRef.current) callbacksRef.current.onTurn(heldAssistantTurnRef.current);
    heldAssistantTurnRef.current = null;
    setStatus("idle");
    setIsMuted(false);
    callbacksRef.current.onCallEnded?.();
  }, []);

  const sayFarewellAndHangUp = useCallback(
    (farewellInstruction: string) => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      setStatus("ending");
      sendEvent({ type: "response.create", response: { instructions: farewellInstruction } });
      window.setTimeout(endCall, FAREWELL_HANGUP_MS);
    },
    [endCall, sendEvent],
  );

  const handleToolCall = useCallback(
    async (callId: string, rawArguments: string) => {
      setStatus("consulting");
      lastActivityAtRef.current = Date.now();
      let question = "";
      try {
        question = String((JSON.parse(rawArguments) as { pergunta?: string }).pergunta ?? "");
      } catch {
        question = rawArguments;
      }
      const answer = question.trim()
        ? await withTimeout(
            callbacksRef.current.askAstro(question.trim()).catch(() => "Não consegui consultar agora."),
            ASK_ASTRO_TIMEOUT_MS,
            "A consulta demorou demais e não terminou.",
          )
        : "Pedido vazio.";
      suppressNextAssistantRef.current = true;
      sendEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify({ resposta: answer }) },
      });
      sendEvent({ type: "response.create" });
    },
    [sendEvent],
  );

  const handleServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      const flushUserTurn = (itemId: string) => {
        const userText = pendingUserTextRef.current;
        pendingUserTextRef.current = null;
        if (userText && !turnUsedToolRef.current) {
          callbacksRef.current.onTurn({ id: `voice-user-${itemId}`, role: "user", text: userText });
        }
        if (heldAssistantTurnRef.current) {
          callbacksRef.current.onTurn(heldAssistantTurnRef.current);
          heldAssistantTurnRef.current = null;
        }
      };

      switch (event.type) {
        case "input_audio_buffer.speech_started":
          lastActivityAtRef.current = Date.now();
          if (heldAssistantTurnRef.current) {
            callbacksRef.current.onTurn(heldAssistantTurnRef.current);
            heldAssistantTurnRef.current = null;
          }
          pendingUserTextRef.current = null;
          turnResolvedRef.current = false;
          turnUsedToolRef.current = false;
          setStatus("listening");
          break;
        case "conversation.item.input_audio_transcription.completed": {
          const userText = event.transcript?.trim();
          if (!userText) break;
          pendingUserTextRef.current = userText;
          if (turnResolvedRef.current) flushUserTurn(event.item_id ?? crypto.randomUUID());
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done":
          if (event.response_id && event.transcript?.trim()) {
            assistantTranscriptsRef.current.set(event.response_id, {
              itemId: event.item_id ?? event.response_id,
              text: event.transcript.trim(),
            });
          }
          break;
        case "output_audio_buffer.started":
          lastActivityAtRef.current = Date.now();
          if (!isEndingRef.current) setStatus("speaking");
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          if (!isEndingRef.current) setStatus((current) => (current === "consulting" ? current : "listening"));
          break;
        case "response.function_call_arguments.done":
          if (event.name === TOOL_NAME && event.call_id) {
            turnUsedToolRef.current = true;
            void handleToolCall(event.call_id, event.arguments ?? "{}");
          }
          break;
        case "response.done": {
          const responseId = event.response?.id ?? "";
          // Consumo real de cada resposta vai para o custo e o saldo de IA (spec 0055); falha não interrompe a conversa.
          if (event.response?.usage && callTokenRef.current) {
            void fetch(USAGE_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callToken: callTokenRef.current, usage: event.response.usage }),
              keepalive: true,
            }).catch(() => undefined);
          }
          const hasToolCall = (event.response?.output ?? []).some((outputItem) => outputItem.type === "function_call");
          const assistantTranscript = assistantTranscriptsRef.current.get(responseId);
          assistantTranscriptsRef.current.delete(responseId);
          if (hasToolCall) turnUsedToolRef.current = true;
          // A fala que só anuncia ou resume a consulta já aparece como resposta do ASTRO de texto.
          const isToolSummary = suppressNextAssistantRef.current && !hasToolCall;
          if (isToolSummary) suppressNextAssistantRef.current = false;
          const assistantTurn =
            assistantTranscript && !hasToolCall && !isToolSummary
              ? { id: `voice-astro-${assistantTranscript.itemId}`, role: "assistant" as const, text: assistantTranscript.text }
              : null;
          if (!turnResolvedRef.current) {
            turnResolvedRef.current = true;
            if (pendingUserTextRef.current || turnUsedToolRef.current) {
              heldAssistantTurnRef.current = assistantTurn;
              flushUserTurn(responseId);
            } else {
              heldAssistantTurnRef.current = assistantTurn;
            }
          } else if (assistantTurn) {
            callbacksRef.current.onTurn(assistantTurn);
          }
          break;
        }
        case "error":
          console.warn("[astro/voice] erro do servidor de voz:", event.error?.message);
          break;
      }
    },
    [handleToolCall],
  );

  const startTimers = useCallback(
    (maxDurationMs: number) => {
      let minuteNumber = 1;
      const tickTimerId = window.setInterval(() => {
        const elapsedMs = Date.now() - startedAtRef.current;
        setElapsedSeconds(Math.floor(elapsedMs / 1000));
        if (elapsedMs >= maxDurationMs - FAREWELL_LEAD_MS) {
          sayFarewellAndHangUp("Diga em uma frase curta e simpática que o tempo da chamada acabou e que a pessoa pode ligar de novo quando quiser.");
        } else if (Date.now() - lastActivityAtRef.current > SILENCE_LIMIT_MS) {
          endCall();
        }
      }, 1000);
      const heartbeatTimerId = window.setInterval(async () => {
        minuteNumber += 1;
        try {
          const response = await fetch(HEARTBEAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callToken: callTokenRef.current, minuteNumber }),
          });
          const heartbeat = (await response.json()) as { action?: string; reason?: string };
          if (heartbeat.action === "stop") {
            sayFarewellAndHangUp(
              heartbeat.reason === "NO_BALANCE"
                ? "Diga em uma frase que os Stars da empresa acabaram e que a chamada vai encerrar; dá para recarregar e voltar."
                : "Diga em uma frase que a chamada vai encerrar agora.",
            );
          }
        } catch {
          // Rede oscilou: o próximo batimento tenta de novo; o teto de duração continua valendo.
        }
      }, HEARTBEAT_INTERVAL_MS);
      timerIdsRef.current.push(tickTimerId, heartbeatTimerId);
    },
    [endCall, sayFarewellAndHangUp],
  );

  const startCall = useCallback(async () => {
    if (peerConnectionRef.current || status === "connecting") return;
    if (!isWebRtcSupported()) {
      callbacksRef.current.onError("UNSUPPORTED", "Este navegador não suporta conversa por voz em tempo real.");
      return;
    }
    setStatus("connecting");
    isEndingRef.current = false;
    // O áudio precisa nascer dentro do toque: no iPhone, criar depois deixa o ASTRO mudo.
    const remoteAudio = remoteAudioRef.current ?? new Audio();
    remoteAudio.autoplay = true;
    remoteAudioRef.current = remoteAudio;

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setStatus("idle");
      callbacksRef.current.onError("MIC_DENIED", "Permita o microfone para conversar com o Astro.");
      return;
    }
    micStreamRef.current = micStream;

    try {
      const sessionResponse = await fetch(SESSION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceModelId: useAstroModelPreference.getState().realtimeVoiceModelId }),
      });
      const voiceSession = (await sessionResponse.json()) as {
        clientSecret?: string;
        callToken?: string;
        maxDurationMs?: number;
        code?: string;
        error?: string;
      };
      if (!sessionResponse.ok || !voiceSession.clientSecret || !voiceSession.callToken) {
        micStream.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        setStatus("idle");
        callbacksRef.current.onError(voiceSession.code ?? "CONNECTION_FAILED", voiceSession.error ?? "Não consegui abrir a voz agora.");
        return;
      }
      callTokenRef.current = voiceSession.callToken;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;
      peerConnection.ontrack = (trackEvent) => {
        remoteAudio.srcObject = trackEvent.streams[0];
        void remoteAudio.play().catch(() => undefined);
      };
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "disconnected") endCall();
      };
      micStream.getTracks().forEach((track) => peerConnection.addTrack(track, micStream));

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (messageEvent) => {
        try {
          handleServerEvent(JSON.parse(String(messageEvent.data)) as RealtimeServerEvent);
        } catch {
          // Evento fora do formato esperado: ignora sem derrubar a chamada.
        }
      };
      dataChannel.onopen = () => {
        startedAtRef.current = Date.now();
        lastActivityAtRef.current = Date.now();
        setElapsedSeconds(0);
        setStatus("listening");
        startTimers(voiceSession.maxDurationMs ?? 15 * 60_000);
        sendEvent({
          type: "response.create",
          response: { instructions: "Você é o ASTRO. Em português do Brasil, numa frase curta e calorosa, diga que está ouvindo e pergunte como pode ajudar." },
        });
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const answerResponse = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${voiceSession.clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!answerResponse.ok) throw new Error(`realtime calls ${answerResponse.status}`);
      await peerConnection.setRemoteDescription({ type: "answer", sdp: await answerResponse.text() });
    } catch (connectionError) {
      console.warn("[astro/voice] falha ao conectar:", connectionError);
      endCall();
      callbacksRef.current.onError("CONNECTION_FAILED", "A conexão de voz falhou. Tente de novo.");
    }
  }, [endCall, handleServerEvent, sendEvent, startTimers, status]);

  const toggleMute = useCallback(() => {
    const nextIsMuted = !isMuted;
    micStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextIsMuted;
    });
    setIsMuted(nextIsMuted);
  }, [isMuted]);

  useEffect(() => endCall, [endCall]);

  return { status, elapsedSeconds, isMuted, isActive: status !== "idle", startCall, endCall, toggleMute };
}
