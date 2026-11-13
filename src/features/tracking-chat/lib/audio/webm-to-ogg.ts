"use client";

/**
 * Converte o áudio gravado no navegador (WebM/Opus, do MediaRecorder) para a
 * nota de voz que a WhatsApp Cloud API (Meta) aceita: OGG/Opus **mono**. Só o
 * caminho META_CLOUD usa isto; a Uazapi transcodifica sozinha.
 *
 * Re-codifica em vez de só trocar o container: o Chrome no Windows grava o
 * microfone em estéreo, e a Meta aceita o upload mas o WhatsApp do cliente
 * não toca ("algo errado com o arquivo de áudio").
 */

import {
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  OggOutputFormat,
  Output,
  WebMInputFormat,
} from "mediabunny";

const VOICE_NOTE_CHANNELS = 1;
const OPUS_SAMPLE_RATE_HZ = 48_000;
// ~3 min cabem nos 512 KB em que o WhatsApp ainda mostra o botão de play.
const VOICE_NOTE_BITRATE_BPS = 24_000;

export async function convertWebmToOggOpus(blob: Blob): Promise<Blob> {
  const input = new Input({
    formats: [new WebMInputFormat()],
    source: new BlobSource(blob),
  });

  const target = new BufferTarget();
  const output = new Output({
    format: new OggOutputFormat(),
    target,
  });

  const conversion = await Conversion.init({
    input,
    output,
    audio: {
      codec: "opus",
      numberOfChannels: VOICE_NOTE_CHANNELS,
      sampleRate: OPUS_SAMPLE_RATE_HZ,
      bitrate: VOICE_NOTE_BITRATE_BPS,
      forceTranscode: true,
    },
    video: { discard: true },
  });

  if (!conversion.isValid) {
    throw new Error("Navegador não consegue converter o áudio para OGG/Opus.");
  }

  await conversion.execute();

  if (!target.buffer) {
    throw new Error("Conversão de áudio não produziu saída.");
  }

  return new Blob([target.buffer], { type: "audio/ogg" });
}
