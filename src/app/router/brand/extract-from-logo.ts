import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { resolveAnthropicApiKey } from "@/lib/anthropic-key";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

/**
 * Brand Kit extractor — Claude Vision lê o LOGO da empresa e infere o
 * brand kit automaticamente: paleta (≥2 cores hex), fontes sugeridas
 * (heading + body), mood e estilo geral. Resultado é salvo direto na
 * `Organization` (campos `brand_palette_hex`, `brand_font_heading`,
 * `brand_font_body`, `brand_extracted_at`).
 *
 * Esse brand kit é a fundação do NASA Planner 2.0 — depois de salvo,
 * ele é injetado AUTOMATICAMENTE em todos os prompts de IA (imagem,
 * vídeo, texto) via o helper `buildBrandedContext(orgId)` em
 * `src/features/nasa-planner/lib/brand-context.ts`. Garante que toda
 * geração siga a identidade da marca, sem o usuário precisar configurar
 * cor/fonte em cada operação.
 *
 * Padrão espelhado de `extract-budget.ts` (Claude Haiku 4.5 + AI SDK
 * `generateObject` com schema Zod) — output estruturado garantido pelo
 * modelo.
 *
 * Custo: 5★ (action `brand_extract`). Cobrança upfront via
 * `chargeStarsByAction` — evita gastar token Anthropic sem saldo.
 */

const brandExtractionSchema = z.object({
  palette: z
    .array(z.string().regex(/^#[0-9A-Fa-f]{6}$/))
    .min(2)
    .max(6)
    .describe(
      "Paleta de cores em formato hex (#RRGGBB). 2-6 cores. A primeira " +
        "deve ser a cor primária (dominante no logo), seguida das " +
        "secundárias e neutras. NÃO inclua branco puro nem preto puro " +
        "como cor primária — só se forem realmente parte da identidade.",
    ),
  suggestedHeadingFont: z
    .string()
    .describe(
      "Nome de uma fonte do Google Fonts apropriada pra HEADINGS " +
        "(títulos grandes), alinhada ao mood do logo. Exemplos: 'Playfair " +
        "Display' (luxo/elegante), 'Inter' (clean/moderno), 'Bebas Neue' " +
        "(bold/impacto), 'Cormorant Garamond' (serif elegante).",
    ),
  suggestedBodyFont: z
    .string()
    .describe(
      "Nome de uma fonte do Google Fonts pra BODY (textos longos). " +
        "Sempre legível em corpo pequeno. Exemplos: 'Inter', 'Lato', " +
        "'Open Sans', 'Source Sans 3'. Geralmente sans-serif neutra.",
    ),
  mood: z
    .enum([
      "elegant",
      "modern",
      "minimal",
      "bold",
      "playful",
      "luxury",
      "corporate",
      "vibrant",
    ])
    .describe("Mood dominante do logo, usado pra ranquear templates."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "'high' se o logo tem cores e tipografia claramente identificáveis. " +
        "'low' se é monocromático, muito ruidoso, ou em baixa resolução.",
    ),
});

export type ExtractedBrand = z.infer<typeof brandExtractionSchema>;

export const extractFromLogo = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/brand/extract-from-logo",
    summary: "Extract brand palette + fonts from a logo image via Claude Vision",
    tags: ["Brand", "IA"],
  })
  .input(
    z.object({
      logoFileKey: z
        .string()
        .min(1)
        .describe("Chave S3/R2 do logo já subido (PNG, JPG, ou SVG)"),
      /**
       * Se `true`, persiste o resultado direto em `Organization.brandPaletteHex`
       * + `brandFontHeading` + `brandFontBody` + `brandExtractedAt` + `brandLogoUrl`.
       * Padrão `true` — extração serve pra popular, não pra preview.
       */
      persist: z.boolean().default(true),
    }),
  )
  .output(
    z.object({
      palette: z.array(z.string()),
      suggestedHeadingFont: z.string(),
      suggestedBodyFont: z.string(),
      mood: z.enum([
        "elegant",
        "modern",
        "minimal",
        "bold",
        "playful",
        "luxury",
        "corporate",
        "vibrant",
      ]),
      confidence: z.enum(["high", "medium", "low"]),
      persisted: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // ── 1. Cobrança 5★ upfront ────────────────────────────────────────────
    // Claude Vision é caro (~5× texto). Não queremos gastar token sem saldo.
    const charge = await chargeStarsByAction(context.org.id, "brand_extract", {
      userId: context.user.id,
      appSlug: "brand_extract",
      description: "Extração de Brand Kit do logo (Claude Vision)",
    });
    if (!charge.success) {
      throw errors.BAD_REQUEST({
        message: "Saldo de STARs insuficiente pra extrair brand kit (5★).",
        data: { code: "INSUFFICIENT_STARS" },
      });
    }

    // ── 2. Verifica chave Anthropic da org ────────────────────────────────
    const apiKey = await resolveAnthropicApiKey(context.org.id);
    if (!apiKey) {
      throw errors.FORBIDDEN({
        message:
          "IA não configurada — peça pro admin configurar a chave Anthropic em Configurações da Organização.",
      });
    }

    // ── 3. Baixa o logo do S3/R2 ──────────────────────────────────────────
    let bytes: Uint8Array;
    let mediaType: string;
    try {
      const cmd = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: input.logoFileKey,
      });
      const res = await S3.send(cmd);
      if (!res.Body) {
        throw new Error("Logo vazio no storage");
      }
      const chunks: Uint8Array[] = [];
      // @ts-expect-error — AWS SDK Body é AsyncIterable<Uint8Array> no Node
      for await (const chunk of res.Body) {
        chunks.push(chunk as Uint8Array);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      bytes = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      // Fallback por extensão se ContentType vazio
      const lowered = input.logoFileKey.toLowerCase();
      mediaType =
        res.ContentType ||
        (lowered.endsWith(".png")
          ? "image/png"
          : lowered.endsWith(".webp")
            ? "image/webp"
            : lowered.endsWith(".svg")
              ? "image/svg+xml"
              : "image/jpeg");
    } catch (err) {
      console.error("[brand.extractFromLogo] failed to fetch logo from S3", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Não consegui ler o logo do storage. Tente subir de novo.",
      });
    }

    // ── 4. Chama Claude Vision com schema estruturado ─────────────────────
    const anthropic = createAnthropic({ apiKey });
    let result: ExtractedBrand;
    try {
      const { object } = await generateObject({
        model: anthropic("claude-haiku-4-5-20251001"),
        schema: brandExtractionSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analise este LOGO de uma empresa e extraia o brand kit " +
                  "estruturado conforme o schema fornecido. Considere:\n\n" +
                  "1. PALETA: identifique as cores dominantes (ignore fundo " +
                  "neutro quando o logo tem fundo transparente). Retorne em " +
                  "formato hex #RRGGBB. Mínimo 2, máximo 6 cores.\n\n" +
                  "2. FONTES: sugira pares (heading + body) do Google Fonts " +
                  "que sejam coerentes com a tipografia do logo (caso o logo " +
                  "tenha texto) ou com o mood geral.\n\n" +
                  "3. MOOD: escolha o mais coerente com o estilo visual. " +
                  "Justifica internamente antes de decidir.\n\n" +
                  "4. CONFIANÇA: baixa pra logos monocromáticos, " +
                  "ilegíveis ou em baixa resolução.",
              },
              {
                type: "image",
                image: bytes,
                mediaType,
              },
            ],
          },
        ],
        maxOutputTokens: 600,
      });
      result = object;
    } catch (err) {
      console.error("[brand.extractFromLogo] AI call failed", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message:
          "Falha ao analisar o logo com a IA. Tente novamente ou preencha o brand kit manualmente.",
      });
    }

    // ── 5. Persiste (ou só retorna preview) ───────────────────────────────
    if (input.persist) {
      await prisma.organization.update({
        where: { id: context.org.id },
        data: {
          brandPaletteHex: result.palette,
          brandFontHeading: result.suggestedHeadingFont,
          brandFontBody: result.suggestedBodyFont,
          brandLogoUrl: input.logoFileKey,
          brandExtractedAt: new Date(),
        },
      });
    }

    return {
      palette: result.palette,
      suggestedHeadingFont: result.suggestedHeadingFont,
      suggestedBodyFont: result.suggestedBodyFont,
      mood: result.mood,
      confidence: result.confidence,
      persisted: input.persist,
    };
  });
