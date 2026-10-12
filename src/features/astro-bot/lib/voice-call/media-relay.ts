import "server-only";
import { MediaStreamTrack, RTCPeerConnection, RTCRtpCodecParameters, RtpHeader, RtpPacket } from "werift";
import { createRealtimeCall } from "./realtime-call";
import { TYPING_SOUND_FRAMES, TYPING_SOUND_FRAME_MS } from "./typing-sound";

/**
 * Retransmissor de áudio entre a Meta e a voz em tempo real da OpenAI (spec 0086).
 *
 * As duas pontas são do tipo que espera o outro lado iniciar a conexão de áudio
 * (ICE-lite), então ligadas direto nenhuma inicia e a chamada fica muda. Este
 * servidor entra no meio: abre uma conexão com cada uma, iniciando as duas, e
 * repassa os pacotes de voz de uma para a outra sem converter (as duas usam Opus).
 */

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const ICE_GATHERING_TIMEOUT_MS = 2500;
const OPUS_PAYLOAD_TYPE = 111;
const PACKET_REPORT_MS = 5000;

function createPeer(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    codecs: {
      audio: [
        new RTCRtpCodecParameters({ mimeType: "audio/opus", clockRate: 48000, channels: 2, payloadType: OPUS_PAYLOAD_TYPE }),
      ],
    },
  });
}

/** Os endereços de conexão vão dentro da descrição; espera reuni-los antes de enviá-la. */
async function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS);
    peer.iceGatheringStateChange.subscribe((state) => {
      if (state !== "complete") return;
      clearTimeout(timeout);
      resolve();
    });
  });
}

export interface MediaRelay {
  /** Resposta de conexão de áudio a devolver à Meta. */
  metaSdpAnswer: string;
  realtimeCallId: string;
  /** Liga ou desliga o som de teclado para quem ligou. Sem efeito quando o recurso está desligado. */
  setTypingSound: (isActive: boolean) => void;
  close: () => Promise<void>;
}

const OPUS_SAMPLES_PER_FRAME = 960;
/** Pacote de voz de verdade é bem maior que isto; abaixo é silêncio codificado. */
const SILENCE_PAYLOAD_BYTES = 12;
/** Depois de uma fala do Astro, o teclado espera isto para não emendar na voz. */
const QUIET_AFTER_VOICE_MS = 350;
const MAX_FRAMES_PER_TICK = 3;
const MAX_SOURCE_GAP_SAMPLES = 48_000 * 10;

/**
 * Som de teclado enquanto uma consulta roda (spec 0087). O servidor só repassa o áudio da OpenAI,
 * então tocar um som próprio exige mandar pacotes nossos no mesmo fluxo. Para quem ouve, é um fluxo
 * só: por isso toda a numeração de saída (sequência e tempo) passa a ser feita aqui. A voz do Astro
 * sempre vence: havendo fala, o teclado se cala.
 */
export function createCallerAudioWriter(toCallerTrack: Pick<MediaStreamTrack, "writeRtp">) {
  const typingFrames = TYPING_SOUND_FRAMES.map((frame) => Buffer.from(frame, "base64"));
  let template: { ssrc: number; payloadType: number } | null = null;
  let outSequence = 0;
  let outTimestamp = 0;
  let lastSourceTimestamp = 0;
  let needsResync = false;
  let lastVoiceAt = 0;
  let isTyping = false;
  let typingStartedAt = 0;
  let typingFramesSent = 0;
  let timer: NodeJS.Timeout | null = null;

  const nextSequence = () => (outSequence = (outSequence + 1) & 0xffff);
  const advanceTimestamp = (samples: number) => (outTimestamp = (outTimestamp + samples) >>> 0);

  const forward = (packet: RtpPacket) => {
    const isVoice = packet.payload.length > SILENCE_PAYLOAD_BYTES;
    if (!template) {
      template = { ssrc: packet.header.ssrc, payloadType: packet.header.payloadType };
      outSequence = packet.header.sequenceNumber;
      outTimestamp = packet.header.timestamp;
      lastSourceTimestamp = packet.header.timestamp;
      if (isVoice) lastVoiceAt = Date.now();
      toCallerTrack.writeRtp(packet);
      return;
    }
    // Silêncio da OpenAI durante o teclado é substituído pelo som: repassar os dois dobraria o fluxo.
    if (isTyping && !isVoice) {
      needsResync = true;
      lastSourceTimestamp = packet.header.timestamp;
      return;
    }
    if (isVoice) lastVoiceAt = Date.now();
    const sourceStep = (packet.header.timestamp - lastSourceTimestamp) >>> 0;
    const step = needsResync || sourceStep === 0 || sourceStep > MAX_SOURCE_GAP_SAMPLES ? OPUS_SAMPLES_PER_FRAME : sourceStep;
    needsResync = false;
    lastSourceTimestamp = packet.header.timestamp;
    packet.header.sequenceNumber = nextSequence();
    packet.header.timestamp = advanceTimestamp(step);
    toCallerTrack.writeRtp(packet);
  };

  const sendTypingFrames = () => {
    if (!isTyping || !template) return;
    const framesDue = Math.floor((Date.now() - typingStartedAt) / TYPING_SOUND_FRAME_MS) - typingFramesSent;
    if (framesDue <= 0) return;
    // Atrasou demais (processo ocupado): não despeja tudo de uma vez.
    const framesNow = Math.min(framesDue, MAX_FRAMES_PER_TICK);
    typingFramesSent += framesDue - framesNow;
    for (let frame = 0; frame < framesNow; frame += 1) {
      typingFramesSent += 1;
      if (Date.now() - lastVoiceAt < QUIET_AFTER_VOICE_MS) continue;
      const header = new RtpHeader({
        version: 2,
        payloadType: template.payloadType,
        ssrc: template.ssrc,
        sequenceNumber: nextSequence(),
        timestamp: advanceTimestamp(OPUS_SAMPLES_PER_FRAME),
        marker: false,
      });
      needsResync = true;
      toCallerTrack.writeRtp(new RtpPacket(header, typingFrames[typingFramesSent % typingFrames.length]));
    }
  };

  return {
    forward,
    setTyping(isActive: boolean) {
      if (isActive === isTyping) return;
      isTyping = isActive;
      if (timer) clearInterval(timer);
      timer = null;
      if (!isActive) return;
      typingStartedAt = Date.now();
      typingFramesSent = 0;
      timer = setInterval(() => {
        try {
          sendTypingFrames();
        } catch {
          // Som de enfeite nunca pode derrubar a ligação: falhou, desliga.
          isTyping = false;
          if (timer) clearInterval(timer);
          timer = null;
        }
      }, TYPING_SOUND_FRAME_MS);
    },
    stop() {
      isTyping = false;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export async function createMediaRelay(params: {
  apiKey: string;
  metaSdpOffer: string;
  sessionConfig: Record<string, unknown>;
  onStateChange?: (leg: "meta" | "openai", state: string) => void;
  onPacketCount?: (count: { fromCaller: number; fromAstro: number }) => void;
  /** Desligado, o áudio do Astro é repassado intocado, como sempre foi. */
  hasTypingSound?: boolean;
}): Promise<MediaRelay> {
  const metaPeer = createPeer();
  const openAiPeer = createPeer();
  let callerAudioWriter: ReturnType<typeof createCallerAudioWriter> | null = null;
  const closeBoth = async () => {
    callerAudioWriter?.stop();
    await Promise.allSettled([metaPeer.close(), openAiPeer.close()]);
  };

  try {
    const toMetaTrack = new MediaStreamTrack({ kind: "audio" });
    const toOpenAiTrack = new MediaStreamTrack({ kind: "audio" });
    if (params.hasTypingSound) callerAudioWriter = createCallerAudioWriter(toMetaTrack);
    const metaTransceiver = metaPeer.addTransceiver(toMetaTrack, { direction: "sendrecv" });
    const openAiTransceiver = openAiPeer.addTransceiver(toOpenAiTrack, { direction: "sendrecv" });

    // Voz de quem ligou segue para a OpenAI; voz do Astro segue para quem ligou.
    const packetCount = { fromCaller: 0, fromAstro: 0 };
    metaTransceiver.onTrack.subscribe((callerTrack) => {
      callerTrack.onReceiveRtp.subscribe((packet) => {
        packetCount.fromCaller += 1;
        toOpenAiTrack.writeRtp(packet);
      });
    });
    openAiTransceiver.onTrack.subscribe((astroTrack) => {
      astroTrack.onReceiveRtp.subscribe((packet) => {
        packetCount.fromAstro += 1;
        if (callerAudioWriter) callerAudioWriter.forward(packet);
        else toMetaTrack.writeRtp(packet);
      });
    });
    // Diagnóstico de chamada muda: mostra de que lado o áudio parou de chegar.
    if (params.onPacketCount) {
      const reportTimer = setInterval(() => params.onPacketCount?.({ ...packetCount }), PACKET_REPORT_MS);
      metaPeer.connectionStateChange.subscribe((state) => {
        if (state === "closed" || state === "failed") clearInterval(reportTimer);
      });
    }
    metaPeer.connectionStateChange.subscribe((state) => params.onStateChange?.("meta", state));
    openAiPeer.connectionStateChange.subscribe((state) => params.onStateChange?.("openai", state));

    // As duas pernas são preparadas ao mesmo tempo, para atender mais rápido.
    const prepareMetaAnswer = async () => {
      await metaPeer.setRemoteDescription({ type: "offer", sdp: params.metaSdpOffer });
      await metaPeer.setLocalDescription(await metaPeer.createAnswer());
      await waitForIceGathering(metaPeer);
      return metaPeer.localDescription!.sdp;
    };
    const connectOpenAi = async () => {
      await openAiPeer.setLocalDescription(await openAiPeer.createOffer());
      await waitForIceGathering(openAiPeer);
      const realtimeCall = await createRealtimeCall({
        apiKey: params.apiKey,
        sdpOffer: openAiPeer.localDescription!.sdp,
        sessionConfig: params.sessionConfig,
      });
      await openAiPeer.setRemoteDescription({ type: "answer", sdp: realtimeCall.sdpAnswer });
      return realtimeCall.realtimeCallId;
    };
    const [metaSdpAnswer, realtimeCallId] = await Promise.all([prepareMetaAnswer(), connectOpenAi()]);
    return {
      metaSdpAnswer,
      realtimeCallId,
      setTypingSound: (isActive) => callerAudioWriter?.setTyping(isActive),
      close: closeBoth,
    };
  } catch (relayError) {
    await closeBoth();
    throw relayError;
  }
}
