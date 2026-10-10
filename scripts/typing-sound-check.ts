// Confere a numeração do áudio enviado a quem ligou quando o som de teclado entra e sai (spec 0087).
// Rodar: pnpm tsx --conditions=react-server scripts/typing-sound-check.ts
import { RtpHeader, RtpPacket } from "werift";
import { createCallerAudioWriter } from "../src/features/astro-bot/lib/voice-call/media-relay";

const FAKE_SOURCE_BYTE = 0xab;
const sent: { sequenceNumber: number; timestamp: number; bytes: number; isFromOpenAi: boolean }[] = [];
const writer = createCallerAudioWriter({
  writeRtp: (packet: RtpPacket) => {
    sent.push({ sequenceNumber: packet.header.sequenceNumber, timestamp: packet.header.timestamp, bytes: packet.payload.length, isFromOpenAi: packet.payload.every((byte) => byte === FAKE_SOURCE_BYTE) });
  },
} as never);

let sourceSequence = 65_500;
let sourceTimestamp = 4_294_900_000;
function fromOpenAi(bytes: number) {
  sourceSequence = (sourceSequence + 1) & 0xffff;
  sourceTimestamp = (sourceTimestamp + 960) >>> 0;
  writer.forward(new RtpPacket(new RtpHeader({ version: 2, payloadType: 111, ssrc: 77, sequenceNumber: sourceSequence, timestamp: sourceTimestamp, marker: false }), Buffer.alloc(bytes, FAKE_SOURCE_BYTE)));
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let i = 0; i < 60; i += 1) fromOpenAi(90);
  const voiceBefore = sent.length;
  await wait(400);
  writer.setTyping(true);
  for (let i = 0; i < 40; i += 1) {
    fromOpenAi(4);
    await wait(20);
  }
  const duringTyping = sent.length - voiceBefore;
  for (let i = 0; i < 20; i += 1) fromOpenAi(90);
  const afterVoiceOverTyping = sent.length;
  await wait(100);
  const typingRightAfterVoice = sent.length - afterVoiceOverTyping;
  writer.setTyping(false);
  for (let i = 0; i < 30; i += 1) fromOpenAi(90);
  writer.stop();

  let failures = 0;
  const check = (label: string, isOk: boolean, detail = "") => {
    if (!isOk) failures += 1;
    console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
  };
  const isSequenceContinuous = sent.every((packet, index) => index === 0 || packet.sequenceNumber === ((sent[index - 1].sequenceNumber + 1) & 0xffff));
  const isTimestampForward = sent.every((packet, index) => index === 0 || ((packet.timestamp - sent[index - 1].timestamp) >>> 0) === 960);
  check("sequência contínua, inclusive na virada de 65535 para 0", isSequenceContinuous);
  check("tempo sempre avança 20 ms por pacote, inclusive na virada de 32 bits", isTimestampForward);
  check("teclado toca enquanto a OpenAI manda silêncio", duringTyping >= 30 && duringTyping <= 45, `${duringTyping} pacotes em ~800 ms`);
  check("silêncio da OpenAI não é repassado junto com o teclado", sent.slice(voiceBefore, voiceBefore + duringTyping).every((packet) => !packet.isFromOpenAi));
  check("teclado se cala logo depois da voz", typingRightAfterVoice === 0, `${typingRightAfterVoice} pacotes de teclado em 100 ms`);
  check("depois de desligar, a voz segue normal", sent.slice(-30).every((packet) => packet.bytes === 90));
  console.log(failures === 0 ? "TUDO CERTO" : `${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}
void main();
