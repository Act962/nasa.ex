/**
 * Decodifica o arquivo OFX respeitando o encoding declarado no próprio header.
 *
 * O parser de OFX recebe string, e `Buffer.toString()` assume UTF-8. O Nubank
 * emite `ENCODING:UTF-8`, mas bancos legados emitem `ENCODING:USASCII` com
 * `CHARSET:1252` — lidos como UTF-8, os acentos do histórico viram lixo. Por
 * isso o encoding é lido do arquivo, nunca presumido.
 */

const HEADER_SAMPLE_BYTES = 2048;

export interface DecodedOfx {
  content: string;
  /** Rótulo do encoding efetivamente usado, para registro no lote. */
  encoding: string;
}

function readHeaderSample(buffer: Buffer): string {
  // latin1 mapeia byte a byte, então serve para ler o cabeçalho de qualquer
  // arquivo sem risco de quebrar em byte inválido.
  return buffer.subarray(0, HEADER_SAMPLE_BYTES).toString("latin1");
}

function resolveLabel(header: string): string {
  // OFX 2.x é XML e declara o encoding no prolog.
  const xmlProlog = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(header);
  if (xmlProlog) return xmlProlog[1].toUpperCase();

  const encoding = /^\s*ENCODING:\s*(\S+)/im.exec(header)?.[1]?.toUpperCase();
  const charset = /^\s*CHARSET:\s*(\S+)/im.exec(header)?.[1]?.toUpperCase();

  if (encoding === "UTF-8" || encoding === "UTF8") return "UTF-8";
  // USASCII sozinho é ASCII puro; com CHARSET numérico, o número é a code page.
  if (charset && charset !== "NONE" && charset !== "1252") return `WINDOWS-${charset}`;
  if (charset === "1252") return "WINDOWS-1252";
  if (encoding === "USASCII") return "WINDOWS-1252";
  return "UTF-8";
}

export function decodeOfxBuffer(buffer: Buffer): DecodedOfx {
  const label = resolveLabel(readHeaderSample(buffer));

  if (label === "UTF-8") {
    // O BOM sobrevive ao decode e quebra a primeira tag do header.
    const withoutBom =
      buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
        ? buffer.subarray(3)
        : buffer;
    return { content: withoutBom.toString("utf8"), encoding: "UTF-8" };
  }

  try {
    return {
      content: new TextDecoder(label.toLowerCase()).decode(buffer),
      encoding: label,
    };
  } catch {
    // Code page que o runtime não conhece: latin1 nunca lança e preserva os
    // bytes, o que é melhor do que abortar a importação inteira.
    return { content: buffer.toString("latin1"), encoding: "LATIN1" };
  }
}
