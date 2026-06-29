import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Update parcial do brand kit. Aceita qualquer combinação dos campos —
 * usado tanto pelo edit manual (aba Branding) quanto pelo flow de
 * confirmação após extração via Claude Vision (`extract-from-logo`).
 *
 * Validações:
 *  - paletteHex: array de strings hex válidas (#RRGGBB), max 8.
 *  - fontHeading/fontBody: nome do Google Fonts (sem validação contra
 *    catálogo — qualquer string é aceita pra permitir fontes custom).
 *  - logoUrl/logoVariants: chave R2 (não URL pública).
 *
 * NÃO cobra STARs — edição manual é grátis.
 */

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
  message: "Cor inválida — use formato #RRGGBB",
});

export const updateBrandKit = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/brand/update-brand-kit",
    summary: "Update organization's brand kit fields (partial)",
    tags: ["Brand"],
  })
  .input(
    z.object({
      paletteHex: z.array(hexColor).max(8).nullable().optional(),
      fontHeading: z.string().max(80).nullable().optional(),
      fontBody: z.string().max(80).nullable().optional(),
      logoUrl: z.string().nullable().optional(),
      logoVariants: z.record(z.string(), z.string()).nullable().optional(),
      slogan: z.string().max(200).nullable().optional(),
      voiceTone: z.string().max(500).nullable().optional(),
      icp: z.string().max(500).nullable().optional(),
      positioning: z.string().max(500).nullable().optional(),
      aiInstructions: z.string().max(2000).nullable().optional(),
    }),
  )
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context }) => {
    // Monta o `data` só com fields explicitamente passados (undefined =
    // não toca; null = limpar). Prisma respeita undefined como skip.
    const data: Record<string, unknown> = {};
    if (input.paletteHex !== undefined) data.brandPaletteHex = input.paletteHex;
    if (input.fontHeading !== undefined) data.brandFontHeading = input.fontHeading;
    if (input.fontBody !== undefined) data.brandFontBody = input.fontBody;
    if (input.logoUrl !== undefined) data.brandLogoUrl = input.logoUrl;
    if (input.logoVariants !== undefined) data.brandLogoVariants = input.logoVariants;
    if (input.slogan !== undefined) data.brandSlogan = input.slogan;
    if (input.voiceTone !== undefined) data.brandVoiceTone = input.voiceTone;
    if (input.icp !== undefined) data.brandIcp = input.icp;
    if (input.positioning !== undefined) data.brandPositioning = input.positioning;
    if (input.aiInstructions !== undefined) data.brandAiInstructions = input.aiInstructions;

    if (Object.keys(data).length === 0) {
      return { success: true as const };
    }

    await prisma.organization.update({
      where: { id: context.org.id },
      data,
    });

    return { success: true as const };
  });
