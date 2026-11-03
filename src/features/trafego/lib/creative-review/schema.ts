import { z } from "zod";
import { creativeGuidanceSchema } from "./guidance";

/** Formato guardado da análise (coluna `astroReview` e rascunho do wizard, spec 0126 D-7). */
export const creativeReviewSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["ready", "improve", "risk"]),
  summary: z.string().max(400),
  items: z
    .array(
      z.object({
        group: z.enum(["policy", "technical", "strength"]),
        level: z.enum(["OK", "WARNING", "BLOCKED"]),
        label: z.string().max(120),
        fix: z.string().max(400),
        sourceUrl: z.string().url().max(500).optional(),
      }),
    )
    .max(20),
  readText: z.string().max(1500),
  framesAnalyzed: z.number().int().min(0).max(4),
  analyzedAt: z.string().max(40),
});

/** Criativo escolhido no passo "Criativo" do wizard, antes de o pedido existir (RF-9). */
export const trafegoCreativeDraftSchema = z
  .object({
    fileKey: z.string().min(1).max(500).optional(),
    kind: z.enum(["IMAGE", "VIDEO"]),
    fileName: z.string().max(300).optional(),
    fileSize: z.number().int().min(0).optional(),
    mimeType: z.string().max(120).optional(),
    width: z.number().int().min(0).optional(),
    height: z.number().int().min(0).optional(),
    durationSeconds: z.number().int().min(0).optional(),
    postLink: z.string().url().max(500).optional(),
    review: creativeReviewSchema.optional(),
    /** Texto e título do anúncio digitados no passo, viram a primeira copy do pedido. */
    message: z.string().max(2000).optional(),
    headline: z.string().max(80).optional(),
    /** Frase que já aparece escrita no WhatsApp de quem toca no botão (spec 0130, RF-3). */
    initialMessage: z.string().max(160).optional(),
    /** O que o Astro sugeriu no passo a passo (spec 0129, RF-8): a equipe e o "Publicar e editar" usam. */
    guidance: creativeGuidanceSchema.optional(),
  })
  .refine((draft) => !(draft.fileKey && draft.postLink) && Boolean(draft.fileKey || draft.postLink || draft.message), {
    message: "Envie um arquivo, o link de um post ou o texto do anúncio.",
  });

export type TrafegoCreativeDraft = z.infer<typeof trafegoCreativeDraftSchema>;

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

/** Código do post num link do Instagram (`/p/`, `/reel/`, `/tv/`); null quando não é post (D-6). */
export function parseInstagramShortcode(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}
