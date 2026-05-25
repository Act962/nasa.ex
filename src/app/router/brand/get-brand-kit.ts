import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Retorna o brand kit completo da organização. Consumido pela aba
 * "Branding" do NASA Planner (`branding-tab.tsx`), pela galeria de
 * templates (preview com brand aplicada) e pelo editor Konva (aplicação
 * automática de fontes/cores).
 *
 * Inclui:
 *  - Campos do brand kit consolidado (`brand_palette_hex`,
 *    `brand_font_heading`, `brand_font_body`, `brand_logo_url`,
 *    `brand_logo_variants`, `brand_extracted_at`)
 *  - Campos do brand antigo (`brand_slogan`, `brand_voice_tone`, etc.)
 *  - Flag `kitComplete` calculada (logo + ≥2 cores + 1 fonte) — sinaliza
 *    se a org pode usar provider top-de-linha (Recraft V3).
 */

export const getBrandKit = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/brand/get-brand-kit",
    summary: "Get organization's brand kit (consolidated)",
    tags: ["Brand"],
  })
  .output(
    z.object({
      // Brand kit consolidado (sprint 2.0)
      paletteHex: z.array(z.string()).nullable(),
      fontHeading: z.string().nullable(),
      fontBody: z.string().nullable(),
      logoUrl: z.string().nullable(),
      logoVariants: z.record(z.string(), z.string()).nullable(),
      extractedAt: z.date().nullable(),
      // Brand antigo (mantido pra compat)
      slogan: z.string().nullable(),
      website: z.string().nullable(),
      icp: z.string().nullable(),
      positioning: z.string().nullable(),
      voiceTone: z.string().nullable(),
      aiInstructions: z.string().nullable(),
      // Derivado
      kitComplete: z.boolean(),
    }),
  )
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: context.org.id },
      select: {
        brandPaletteHex: true,
        brandFontHeading: true,
        brandFontBody: true,
        brandLogoUrl: true,
        brandLogoVariants: true,
        brandExtractedAt: true,
        brandSlogan: true,
        brandWebsite: true,
        brandIcp: true,
        brandPositioning: true,
        brandVoiceTone: true,
        brandAiInstructions: true,
      },
    });

    const palette = Array.isArray(org.brandPaletteHex)
      ? (org.brandPaletteHex as string[]).filter(
          (c): c is string => typeof c === "string",
        )
      : null;
    const logoVariants =
      org.brandLogoVariants && typeof org.brandLogoVariants === "object"
        ? (org.brandLogoVariants as Record<string, string>)
        : null;

    // Mesma regra que o helper `buildBrandedContext` — fonte única de
    // verdade pra "brand completo" é: logo + ≥2 cores + fonte heading.
    const kitComplete =
      !!org.brandLogoUrl &&
      !!palette &&
      palette.length >= 2 &&
      !!org.brandFontHeading;

    return {
      paletteHex: palette,
      fontHeading: org.brandFontHeading ?? null,
      fontBody: org.brandFontBody ?? null,
      logoUrl: org.brandLogoUrl ?? null,
      logoVariants,
      extractedAt: org.brandExtractedAt ?? null,
      slogan: org.brandSlogan ?? null,
      website: org.brandWebsite ?? null,
      icp: org.brandIcp ?? null,
      positioning: org.brandPositioning ?? null,
      voiceTone: org.brandVoiceTone ?? null,
      aiInstructions: org.brandAiInstructions ?? null,
      kitComplete,
    };
  });
