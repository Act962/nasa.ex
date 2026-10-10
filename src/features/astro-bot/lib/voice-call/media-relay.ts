import "server-only";
import { MediaStreamTrack, RTCPeerConnection, RTCRtpCodecParameters } from "werift";
import { createRealtimeCall } from "./realtime-call";

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
  close: () => Promise<void>;
}

export async function createMediaRelay(params: {
  apiKey: string;
  metaSdpOffer: string;
  sessionConfig: Record<string, unknown>;
  onStateChange?: (leg: "meta" | "openai", state: string) => void;
}): Promise<MediaRelay> {
  const metaPeer = createPeer();
  const openAiPeer = createPeer();
  const closeBoth = async () => {
    await Promise.allSettled([metaPeer.close(), openAiPeer.close()]);
  };

  try {
    const toMetaTrack = new MediaStreamTrack({ kind: "audio" });
    const toOpenAiTrack = new MediaStreamTrack({ kind: "audio" });
    const metaTransceiver = metaPeer.addTransceiver(toMetaTrack, { direction: "sendrecv" });
    const openAiTransceiver = openAiPeer.addTransceiver(toOpenAiTrack, { direction: "sendrecv" });

    // Voz de quem ligou segue para a OpenAI; voz do Astro segue para quem ligou.
    metaTransceiver.onTrack.subscribe((callerTrack) => {
      callerTrack.onReceiveRtp.subscribe((packet) => toOpenAiTrack.writeRtp(packet));
    });
    openAiTransceiver.onTrack.subscribe((astroTrack) => {
      astroTrack.onReceiveRtp.subscribe((packet) => toMetaTrack.writeRtp(packet));
    });
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
    return { metaSdpAnswer, realtimeCallId, close: closeBoth };
  } catch (relayError) {
    await closeBoth();
    throw relayError;
  }
}
