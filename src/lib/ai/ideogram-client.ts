import "server-only";

/**
 * Cliente Ideogram 3.0 — geração de imagem state-of-the-art pra cards
 * de rede social. Diferencial vs DALL-E 3: tipografia LEGÍVEL renderizada
 * dentro da imagem (DALL-E embaralha letras). Ideal pros posts estilo
 * Dra. Thaine (paleta marrom/bege + fonte serifada + título grande na
 * arte).
 *
 * Endpoints:
 *  - Standard ($0.03/img): rápido, OK pra prototipagem
 *  - Quality ($0.06/img): nítido, recomendado pra publicação
 *
 * API key: resolvida via `PlatformIntegration.config.ideogramKey`
 * (org-level) com fallback pra env `IDEOGRAM_API_KEY`. Sem key, o
 * caller (`_helpers/ai-provider.ts`) cai pra Pollinations/DALL-E.
 *
 * Docs: https://developer.ideogram.ai/api-reference/api-reference/generate
 */

import { uploadToS3 } from "@/app/router/nasa-planner/_helpers/ai-provider";

export type IdeogramRendering = "TURBO" | "BALANCED" | "QUALITY";
export type IdeogramAspectRatio = "1x1" | "9x16" | "16x9" | "4x5" | "5x4";

export interface IdeogramGenerateInput {
  prompt: string;
  apiKey: string;
  rendering?: IdeogramRendering; // default "BALANCED"
  aspectRatio?: IdeogramAspectRatio; // default "1x1"
  /**
   * Estilo de geração. "AUTO" funciona pra maioria; "DESIGN" é melhor
   * pra cards/posters com tipografia; "REALISTIC" pra fotos.
   */
  styleType?: "AUTO" | "REALISTIC" | "DESIGN" | "FICTION";
  /**
   * Negative prompt — coisas pra EVITAR na imagem. Útil pra excluir
   * watermarks, mãos malformadas, etc.
   */
  negativePrompt?: string;
}

interface IdeogramResponseImage {
  url: string;
  is_image_safe?: boolean;
  prompt?: string;
  resolution?: string;
}

interface IdeogramResponse {
  created?: string;
  data?: IdeogramResponseImage[];
}

/**
 * Gera 1 imagem via Ideogram 3.0 e faz upload pro nosso bucket R2.
 * Retorna a `imageKey` (não a URL pública, pra ser consistente com
 * `generateImage` em `ai-provider.ts`).
 *
 * Lança em erros de API/rede pra o caller decidir fallback.
 */
export async function generateImageViaIdeogram(
  opts: IdeogramGenerateInput,
): Promise<string> {
  const rendering = opts.rendering ?? "BALANCED";
  const aspectRatio = opts.aspectRatio ?? "1x1";
  const styleType = opts.styleType ?? "AUTO";

  const formData = new FormData();
  formData.append("prompt", opts.prompt.slice(0, 4000));
  formData.append("aspect_ratio", aspectRatio);
  formData.append("rendering_speed", rendering);
  formData.append("style_type", styleType);
  if (opts.negativePrompt) {
    formData.append("negative_prompt", opts.negativePrompt.slice(0, 500));
  }

  // Timeout 90s — Ideogram costuma responder em 5-15s (Standard) ou 20-40s (Quality)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  let resp: Response;
  try {
    resp = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
      method: "POST",
      headers: {
        "Api-Key": opts.apiKey,
        // Não setamos Content-Type — fetch + FormData seta com boundary correto
      },
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Ideogram API ${resp.status}: ${errText}`);
  }

  const data = (await resp.json()) as IdeogramResponse;
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Ideogram não retornou imagem (data.data vazio)");
  }

  // Download da CDN do Ideogram → upload pro nosso R2 pra evitar broken
  // links (URLs do Ideogram expiram após algumas horas)
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) {
    throw new Error(`Falha ao baixar imagem do Ideogram: ${imgResp.status}`);
  }
  const buffer = Buffer.from(await imgResp.arrayBuffer());
  const key = await uploadToS3(buffer, "image/png");
  if (!key) {
    throw new Error("Falha ao subir imagem pro R2");
  }
  return key;
}

/**
 * Resolve a chave de API do Ideogram. Por enquanto só lê de env var
 * `IDEOGRAM_API_KEY` — `IntegrationPlatform.IDEOGRAM` será adicionado
 * ao enum numa próxima migration pra permitir key por-org via UI de
 * integrações. Retorna `null` quando não há key — caller cai pra outro
 * provider.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function resolveIdeogramApiKey(
  _organizationId: string,
): Promise<string | null> {
  return process.env.IDEOGRAM_API_KEY ?? null;
}
