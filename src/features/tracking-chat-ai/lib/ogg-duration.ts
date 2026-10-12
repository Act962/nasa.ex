// Duração de um áudio OGG/Opus (nota de voz do WhatsApp) lida do próprio arquivo, sem transcrever.
// A última página do OGG guarda a posição final em amostras, e o Opus conta sempre a 48 kHz.

const OGG_PAGE_MARK = Buffer.from("OggS");
const OPUS_HEAD_MARK = Buffer.from("OpusHead");
const OPUS_SAMPLES_PER_SECOND = 48_000;
const GRANULE_OFFSET = 6;
const PAGE_HEADER_MIN_BYTES = 27;
const OPUS_HEAD_SEARCH_BYTES = 200;
const MAX_HEADER_TYPE = 7;
const UNKNOWN_GRANULE = 0xffff_ffff_ffff_ffffn;
const MAX_PLAUSIBLE_SECONDS = 6 * 60 * 60;

/** `null` quando o arquivo não é OGG/Opus ou a duração não pôde ser lida com segurança. */
export function readOggOpusSeconds(audio: Buffer): number | null {
  if (audio.length < PAGE_HEADER_MIN_BYTES || !audio.subarray(0, 4).equals(OGG_PAGE_MARK)) return null;
  const opusHeadAt = audio.indexOf(OPUS_HEAD_MARK);
  if (opusHeadAt < 0 || opusHeadAt > OPUS_HEAD_SEARCH_BYTES) return null;

  const lastPageAt = audio.lastIndexOf(OGG_PAGE_MARK);
  if (lastPageAt < 0 || lastPageAt + PAGE_HEADER_MIN_BYTES > audio.length) return null;
  // "OggS" pode aparecer por acaso no meio do áudio: versão e tipo de página confirmam o cabeçalho.
  if (audio[lastPageAt + 4] !== 0 || audio[lastPageAt + 5] > MAX_HEADER_TYPE) return null;

  const finalSamples = audio.readBigUInt64LE(lastPageAt + GRANULE_OFFSET);
  if (finalSamples === UNKNOWN_GRANULE) return null;
  const seconds = Number(finalSamples) / OPUS_SAMPLES_PER_SECOND;
  return seconds > 0 && seconds <= MAX_PLAUSIBLE_SECONDS ? seconds : null;
}
