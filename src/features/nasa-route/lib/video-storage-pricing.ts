// Fallback duplicado da `pricing.ts` (não importamos de lá pra manter este
// arquivo client-safe — `pricing.ts` é "server-only" porque toca prisma).
const FALLBACK_STAR_PRICE_BRL = 0.15;

/**
 * Cálculo de custo de hospedagem de vídeo no R2 NASA Route, cobrado em STARs
 * upfront (uma única vez, não recorrente).
 *
 * Fórmula:
 *   storage_usd = USD_PER_GB_MONTH × size_gb × HORIZON_MONTHS
 *   write_usd   = USD_PER_MULTIPART_PART × ceil(size_mb / 10)
 *   total_usd   = (storage_usd + write_usd) × (1 + PLATFORM_MARGIN_PCT)
 *   total_brl   = total_usd × USD_TO_BRL_RATE
 *   total_stars = ceil(total_brl / starPriceBrl)
 *
 * Pure function, sem side-effects, segura pra rodar client-side (no quote
 * inicial) E server-side (na validação anti-tampering).
 */

// Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing
export const USD_PER_GB_MONTH = 0.015;
// Class A operations (multipart parts, PUTs). Negligente na prática, mas
// incluído pra ser justo com a margem.
export const USD_PER_MULTIPART_PART = 4.5 / 1_000_000;

// Horizonte: 36 meses (3 anos) de hospedagem garantida. Se um dia precisarmos
// arquivar/deletar vídeos antigos, esse é o prazo que prometemos.
export const HORIZON_MONTHS = 36;
// 10% — mesma margem da venda de curso (PLATFORM_FEE_PCT em utils.ts).
export const PLATFORM_MARGIN_PCT = 0.1;
// Taxa USD→BRL — atualizada manualmente. Não vale a pena bater em API por isso.
// Se variar muito (>10%), basta editar aqui e o cálculo já reflete.
export const USD_TO_BRL_RATE = 5.4;

// Chunk de upload multipart: 10 MB. Bate com presigned UploadPart no R2.
export const VIDEO_UPLOAD_PART_SIZE_BYTES = 10 * 1024 * 1024;
// Limite máximo por vídeo (2 GB). Acima disso, recusa upfront.
export const VIDEO_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024;

// Mimes aceitos — server valida idem.
export const VIDEO_UPLOAD_ALLOWED_MIMES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "video/x-matroska", // .mkv (R2 serve sem transcoding, mas browsers não tocam — UI avisa)
] as const;

export interface VideoUploadCostBreakdown {
  sizeBytes: number;
  sizeMb: number;
  sizeGb: number;
  storageUsd: number;
  writeUsd: number;
  marginUsd: number;
  totalUsd: number;
  totalBrl: number;
  stars: number;
  horizonMonths: number;
  starPriceBrl: number;
  totalParts: number;
}

/**
 * Calcula o custo em STARs pra upar um vídeo de `sizeBytes`.
 *
 * `starPriceBrl` vem de `getStarPriceBrl()` (server) ou pode ser passado direto
 * (client, com o valor já cacheado pela home). Default: FALLBACK_STAR_PRICE_BRL.
 */
export function computeVideoUploadCost(
  sizeBytes: number,
  starPriceBrl: number = FALLBACK_STAR_PRICE_BRL,
): VideoUploadCostBreakdown {
  if (sizeBytes <= 0) {
    throw new Error("sizeBytes deve ser > 0");
  }

  const sizeMb = sizeBytes / (1024 * 1024);
  const sizeGb = sizeBytes / (1024 * 1024 * 1024);
  const totalParts = Math.ceil(sizeBytes / VIDEO_UPLOAD_PART_SIZE_BYTES);

  const storageUsd = USD_PER_GB_MONTH * sizeGb * HORIZON_MONTHS;
  const writeUsd = USD_PER_MULTIPART_PART * totalParts;
  const subtotalUsd = storageUsd + writeUsd;
  const marginUsd = subtotalUsd * PLATFORM_MARGIN_PCT;
  const totalUsd = subtotalUsd + marginUsd;
  const totalBrl = totalUsd * USD_TO_BRL_RATE;
  // Sempre arredonda pra cima — não vamos cobrar fração de STAR. Mínimo 1★
  // pra qualquer upload (mesmo um vídeo de 100KB de teste).
  const stars = Math.max(1, Math.ceil(totalBrl / starPriceBrl));

  return {
    sizeBytes,
    sizeMb,
    sizeGb,
    storageUsd,
    writeUsd,
    marginUsd,
    totalUsd,
    totalBrl,
    stars,
    horizonMonths: HORIZON_MONTHS,
    starPriceBrl,
    totalParts,
  };
}

/** "1,2 GB", "850 MB" — pra UI do modal de confirmação. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
