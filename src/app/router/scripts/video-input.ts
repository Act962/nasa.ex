import { z } from "zod";

/** Teto único de 16MB para todos os providers (spec 0004, D-7). */
export const MAX_SCRIPT_VIDEO_BYTES = 16 * 1024 * 1024;

/**
 * Vídeo já enviado pra `videos/scripts/` via `/api/s3/upload-script-video`.
 * O `key` é validado contra o prefixo pra impedir que o payload aponte pra
 * um objeto arbitrário do bucket — a exclusão do script apaga essa key.
 */
export const scriptVideoInput = z.object({
  key: z
    .string()
    .min(1)
    .refine((key) => key.startsWith("videos/scripts/"), {
      message: "Key de vídeo fora do prefixo permitido",
    }),
  mimetype: z.string().min(1),
  fileName: z.string().min(1),
  sizeBytes: z.number().int().positive().max(MAX_SCRIPT_VIDEO_BYTES).nullish(),
});

export type ScriptVideoInput = z.infer<typeof scriptVideoInput>;
