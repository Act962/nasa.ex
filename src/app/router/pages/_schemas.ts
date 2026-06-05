import { z } from "zod";

export const PAGES_STARS_COST = 2000;

export const deviceEnum = z.enum(["desktop", "tablet", "mobile"]);

const basePropsSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    rotation: z.number().optional(),
    opacity: z.number().optional(),
    zIndex: z.number().optional(),
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    animation: z.any().optional(),
    link: z.any().optional(),
    parallax: z.any().optional(),
    responsive: z
      .object({
        tablet: z.any().optional(),
        mobile: z.any().optional(),
        hiddenOn: z.array(deviceEnum).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export const elementSchema = basePropsSchema.extend({
  id: z.string(),
  type: z.string(),
});

export const layerSchema = z.object({
  elements: z.array(elementSchema).default([]),
  background: z.any().optional(),
});

export const artboardSchema = z
  .object({
    width: z.number().default(1440),
    minHeight: z.number().default(900),
    background: z.string().optional(),
  })
  .default({ width: 1440, minHeight: 900 });

export const metaSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    favicon: z.string().optional(),
    og: z.string().optional(),
    // Tracking IDs (UI guarda aqui pra evitar migration no NasaPage).
    metaPixelId: z.string().optional(),
    googleTagId: z.string().optional(),
    gtmId: z.string().optional(),
    // UTM defaults aplicados quando o lead chega sem utm na URL.
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    utmContent: z.string().optional(),
    utmTerm: z.string().optional(),
  })
  .default({});

export const pageLayoutSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    main: layerSchema,
    artboard: artboardSchema,
    meta: metaSchema.optional(),
    sections: z.array(z.any()).optional(),
    tokens: z.any().optional(),
  }),
  z.object({
    mode: z.literal("stacked"),
    back: layerSchema,
    front: layerSchema,
    artboard: artboardSchema,
    meta: metaSchema.optional(),
    sections: z.array(z.any()).optional(),
    tokens: z.any().optional(),
    parallax: z
      .object({
        backSpeed: z.number().default(0.3),
        frontSpeed: z.number().default(1.0),
      })
      .default({ backSpeed: 0.3, frontSpeed: 1.0 }),
  }),
]);

export type PageLayout = z.infer<typeof pageLayoutSchema>;

export const intentEnum = z.enum([
  "INSTITUTIONAL",
  "LANDING",
  "BIO_LINK",
  "EVENT",
  "PRODUCT",
  "PORTFOLIO",
  "CUSTOM",
  "SPACE_PAGE",
]);

export const pageStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(slugRegex, "Slug inválido (letras minúsculas, números e hífens)");

export function emptyLayout(layerCount: 1 | 2): PageLayout {
  const empty = { elements: [] };
  if (layerCount === 2) {
    return {
      mode: "stacked",
      back: empty,
      front: empty,
      artboard: { width: 1440, minHeight: 900 },
      parallax: { backSpeed: 0.3, frontSpeed: 1.0 },
    };
  }
  return {
    mode: "single",
    main: empty,
    artboard: { width: 1440, minHeight: 900 },
  };
}
