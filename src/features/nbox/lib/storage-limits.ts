// Limites do Nbox (spec 0148, D-1). Um lugar só: a tela, o envio e o MCP leem daqui, e a cobrança do excedente vai se ligar aqui.

const GIGABYTE = 1024 * 1024 * 1024;
const MEGABYTE = 1024 * 1024;

const DEFAULT_STORAGE_LIMIT_BYTES = 150 * GIGABYTE;

/** Espaço por plano. Hoje igual em todos, por decisão do produto (2026-11-23). */
export const NBOX_STORAGE_LIMIT_BYTES_BY_PLAN: Record<string, number> = {
  earth: DEFAULT_STORAGE_LIMIT_BYTES,
  explore: DEFAULT_STORAGE_LIMIT_BYTES,
  constellation: DEFAULT_STORAGE_LIMIT_BYTES,
};

export function getNboxStorageLimitBytes(planSlug: string | null | undefined): number {
  return NBOX_STORAGE_LIMIT_BYTES_BY_PLAN[planSlug ?? ""] ?? DEFAULT_STORAGE_LIMIT_BYTES;
}

export const NBOX_MAX_FILE_BYTES = 5 * GIGABYTE;
/** Acima disso o envio vai em partes. */
export const NBOX_MULTIPART_THRESHOLD_BYTES = 100 * MEGABYTE;
/** 5 GB / 64 MB = 80 partes no pior caso. */
export const NBOX_PART_SIZE_BYTES = 64 * MEGABYTE;
export const NBOX_STORAGE_WARNING_RATIO = 0.9;

export const NBOX_TRANSFER_DAY_OPTIONS = [1, 2, 7] as const;
export type NboxTransferDays = (typeof NBOX_TRANSFER_DAY_OPTIONS)[number];
export const NBOX_TRANSFER_DEFAULT_DAYS: NboxTransferDays = 2;
/** Vida máxima de uma transferência, contada da criação. Prorrogar nunca passa disso (D-8). */
export const NBOX_TRANSFER_MAX_DAYS = 7;
/**
 * Regra de expiração configurada no bucket R2 para o prefixo `nbox-transfers/` (painel da Cloudflare, fora do código).
 * Um dia a mais que a vida máxima: a regra nunca apaga link ainda válido.
 */
export const NBOX_TRANSFER_BUCKET_RULE_DAYS = NBOX_TRANSFER_MAX_DAYS + 1;

export const NBOX_STORAGE_FULL_MESSAGE = "Espaço do Nbox cheio. Apague arquivos para liberar espaço.";

