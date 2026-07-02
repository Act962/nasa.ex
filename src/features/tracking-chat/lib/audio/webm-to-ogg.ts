"use client";

/**
 * Converte o áudio gravado no navegador (WebM/Opus, do MediaRecorder) para
 * OGG/Opus — um dos formatos aceitos pela WhatsApp Cloud API (Meta). O gravador
 * produz WebM, que a Meta rejeita; a Uazapi transcodifica sozinha, então isto
 * só é usado no caminho META_CLOUD.
 *
 * WebM/Opus → OGG/Opus é reempacotamento de container: o stream Opus já existe,
 * então a mediabunny copia os pacotes (passthrough, sem re-encode nem perda).
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
    // Mantém o codec Opus: como a saída OGG suporta Opus, os pacotes são
    // copiados direto (sem transcode). Vídeo é descartado por segurança.
    audio: { codec: "opus" },
    video: { discard: true },
  });

  await conversion.execute();

  if (!target.buffer) {
    throw new Error("Conversão de áudio não produziu saída.");
  }

  return new Blob([target.buffer], { type: "audio/ogg" });
}
