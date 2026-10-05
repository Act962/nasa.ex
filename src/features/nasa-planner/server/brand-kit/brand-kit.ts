import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import type { BrandKitAssetKind } from "@/generated/prisma/enums";
import { ensureDefaultPlanner } from "../cross-org";
import {
  BRAND_LOGO_VARIANTS,
  computeBrandKitCompleteness,
  type BrandLogoVariant,
} from "../../lib/brand-kit-completeness";

/**
 * Kit da Marca (specs 0063 e 0070). O kit **padrão** de uma org reaproveita os campos de marca da
 * Organization (lidos também por `buildBrandedContext`) e do planner padrão; os kits **adicionais**
 * moram em BrandKit. Os dois devolvem o mesmo formato, e as listas ficam em BrandKitAsset
 * (`brandKitId` nulo = kit padrão).
 */

export const DEFAULT_BRAND_KIT_NAME = "Padrão da empresa";

export type BrandKitLogos = Record<BrandLogoVariant, string | null>;

export interface BrandKitIdentityInput {
  brandName?: string | null;
  logos?: Partial<BrandKitLogos>;
  palette?: string[];
  fontHeading?: string | null;
  fontBody?: string | null;
  voiceTone?: string | null;
  audience?: string | null;
  positioning?: string | null;
  slogan?: string | null;
  website?: string | null;
  keyMessages?: string[];
  forbiddenWords?: string[];
  defaultHashtags?: string[];
  defaultCtas?: string[];
}

export interface BrandKitIdentity {
  brandName: string | null;
  logos: BrandKitLogos;
  palette: string[];
  fontHeading: string | null;
  fontBody: string | null;
  voiceTone: string | null;
  audience: string | null;
  positioning: string | null;
  slogan: string | null;
  website: string | null;
  keyMessages: string[];
  forbiddenWords: string[];
  defaultHashtags: string[];
  defaultCtas: string[];
}

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const stripHash = (hashtag: string) => hashtag.replace(/^#/, "");

function readLogos(brandLogoUrl: string | null, variants: unknown): BrandKitLogos {
  const stored = (variants && typeof variants === "object" ? variants : {}) as Record<string, unknown>;
  const logos = Object.fromEntries(BRAND_LOGO_VARIANTS.map((variant) => [variant, typeof stored[variant] === "string" ? (stored[variant] as string) : null])) as BrandKitLogos;
  // Variantes antigas (extração por IA) usavam dark/light/monochrome.
  logos.color ??= brandLogoUrl;
  logos.black ??= typeof stored.dark === "string" ? (stored.dark as string) : null;
  logos.white ??= typeof stored.light === "string" ? (stored.light as string) : null;
  return logos;
}

/** Identidade do kit padrão; também serve de base a um kit novo criado como cópia (spec 0070, RF-2). */
export async function readDefaultBrandKitIdentity(organizationId: string): Promise<BrandKitIdentity> {
  const plannerId = await ensureDefaultPlanner(organizationId);
  const [organization, planner] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        brandSlogan: true,
        brandWebsite: true,
        brandIcp: true,
        brandPositioning: true,
        brandVoiceTone: true,
        brandPaletteHex: true,
        brandFontHeading: true,
        brandFontBody: true,
        brandLogoUrl: true,
        brandLogoVariants: true,
      },
    }),
    prisma.nasaPlanner.findUniqueOrThrow({
      where: { id: plannerId },
      select: { brandName: true, keyMessages: true, forbiddenWords: true, defaultHashtags: true, defaultCtas: true },
    }),
  ]);
  return {
    brandName: planner.brandName,
    logos: readLogos(organization.brandLogoUrl, organization.brandLogoVariants),
    palette: toStringArray(organization.brandPaletteHex),
    fontHeading: organization.brandFontHeading,
    fontBody: organization.brandFontBody,
    voiceTone: organization.brandVoiceTone,
    audience: organization.brandIcp,
    positioning: organization.brandPositioning,
    slogan: organization.brandSlogan,
    website: organization.brandWebsite,
    keyMessages: planner.keyMessages,
    forbiddenWords: planner.forbiddenWords,
    defaultHashtags: planner.defaultHashtags,
    defaultCtas: planner.defaultCtas,
  };
}

/** Kit adicional, sempre conferido contra a org: id de outra empresa não lê nada (spec 0070, RNF-4). */
export async function findAdditionalBrandKit(organizationId: string, brandKitId: string) {
  const kit = await prisma.brandKit.findFirst({ where: { id: brandKitId, organizationId } });
  if (!kit) throw new ORPCError("NOT_FOUND", { message: "Kit da marca não encontrado." });
  return kit;
}

type AdditionalBrandKitRow = Awaited<ReturnType<typeof findAdditionalBrandKit>>;

function toIdentity(kit: AdditionalBrandKitRow): BrandKitIdentity {
  return {
    brandName: kit.brandName,
    logos: readLogos(null, kit.logos),
    palette: kit.palette,
    fontHeading: kit.fontHeading,
    fontBody: kit.fontBody,
    voiceTone: kit.voiceTone,
    audience: kit.audience,
    positioning: kit.positioning,
    slogan: kit.slogan,
    website: kit.website,
    keyMessages: kit.keyMessages,
    forbiddenWords: kit.forbiddenWords,
    defaultHashtags: kit.defaultHashtags,
    defaultCtas: kit.defaultCtas,
  };
}

/** Kit padrão quando `brandKitId` é nulo; kit adicional da org caso contrário. O formato é o mesmo. */
export async function getBrandKit(organizationId: string, brandKitId: string | null = null) {
  const additionalKit = brandKitId ? await findAdditionalBrandKit(organizationId, brandKitId) : null;
  const [organization, identity, assets] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true, logo: true } }),
    additionalKit ? toIdentity(additionalKit) : readDefaultBrandKitIdentity(organizationId),
    prisma.brandKitAsset.findMany({
      where: { organizationId, brandKitId: additionalKit?.id ?? null },
      orderBy: [{ kind: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const countOf = (kind: BrandKitAssetKind) => assets.filter((asset) => asset.kind === kind).length;
  const completeness = computeBrandKitCompleteness({
    logos: identity.logos,
    palette: identity.palette,
    fontHeading: identity.fontHeading,
    voiceTone: identity.voiceTone,
    audience: identity.audience,
    positioning: identity.positioning,
    website: identity.website,
    productCount: countOf("PRODUCT"),
    materialCount: countOf("MATERIAL"),
    referencePostCount: countOf("REFERENCE_POST"),
  });

  return {
    organization,
    /** Nulo no kit padrão. */
    brandKitId: additionalKit?.id ?? null,
    kitName: additionalKit?.name ?? DEFAULT_BRAND_KIT_NAME,
    ...identity,
    assets: assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      title: asset.title,
      description: asset.description,
      fileKey: asset.fileKey,
      url: asset.url,
      price: asset.price,
    })),
    completeness,
  };
}

export type BrandKit = Awaited<ReturnType<typeof getBrandKit>>;

async function saveDefaultIdentity(organizationId: string, input: BrandKitIdentityInput) {
  const current = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { brandLogoUrl: true, brandLogoVariants: true },
  });
  const logos = input.logos ? { ...readLogos(current.brandLogoUrl, current.brandLogoVariants), ...input.logos } : null;

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(logos && { brandLogoUrl: logos.color, brandLogoVariants: logos }),
      ...(input.palette && { brandPaletteHex: input.palette }),
      ...(input.fontHeading !== undefined && { brandFontHeading: input.fontHeading }),
      ...(input.fontBody !== undefined && { brandFontBody: input.fontBody }),
      ...(input.voiceTone !== undefined && { brandVoiceTone: input.voiceTone }),
      ...(input.audience !== undefined && { brandIcp: input.audience }),
      ...(input.positioning !== undefined && { brandPositioning: input.positioning }),
      ...(input.slogan !== undefined && { brandSlogan: input.slogan }),
      ...(input.website !== undefined && { brandWebsite: input.website }),
    },
  });

  if (input.brandName !== undefined || input.keyMessages || input.forbiddenWords || input.defaultHashtags || input.defaultCtas) {
    const plannerId = await ensureDefaultPlanner(organizationId);
    await prisma.nasaPlanner.update({
      where: { id: plannerId },
      data: {
        ...(input.brandName !== undefined && { brandName: input.brandName }),
        ...(input.keyMessages && { keyMessages: input.keyMessages }),
        ...(input.forbiddenWords && { forbiddenWords: input.forbiddenWords }),
        ...(input.defaultHashtags && { defaultHashtags: input.defaultHashtags.map(stripHash) }),
        ...(input.defaultCtas && { defaultCtas: input.defaultCtas }),
      },
    });
  }
}

async function saveAdditionalIdentity(organizationId: string, brandKitId: string, input: BrandKitIdentityInput) {
  const current = await findAdditionalBrandKit(organizationId, brandKitId);
  const logos = input.logos ? { ...readLogos(null, current.logos), ...input.logos } : null;
  await prisma.brandKit.update({
    where: { id: current.id },
    data: {
      ...(logos && { logos }),
      ...(input.palette && { palette: input.palette }),
      ...(input.brandName !== undefined && { brandName: input.brandName }),
      ...(input.fontHeading !== undefined && { fontHeading: input.fontHeading }),
      ...(input.fontBody !== undefined && { fontBody: input.fontBody }),
      ...(input.voiceTone !== undefined && { voiceTone: input.voiceTone }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.positioning !== undefined && { positioning: input.positioning }),
      ...(input.slogan !== undefined && { slogan: input.slogan }),
      ...(input.website !== undefined && { website: input.website }),
      ...(input.keyMessages && { keyMessages: input.keyMessages }),
      ...(input.forbiddenWords && { forbiddenWords: input.forbiddenWords }),
      ...(input.defaultHashtags && { defaultHashtags: input.defaultHashtags.map(stripHash) }),
      ...(input.defaultCtas && { defaultCtas: input.defaultCtas }),
    },
  });
}

export async function saveBrandKitIdentity(organizationId: string, brandKitId: string | null, input: BrandKitIdentityInput) {
  if (brandKitId) await saveAdditionalIdentity(organizationId, brandKitId, input);
  else await saveDefaultIdentity(organizationId, input);
  return getBrandKit(organizationId, brandKitId);
}

export async function addBrandKitAsset(
  organizationId: string,
  brandKitId: string | null,
  input: { kind: BrandKitAssetKind; title: string; description?: string | null; fileKey?: string | null; url?: string | null; price?: string | null },
) {
  if (brandKitId) await findAdditionalBrandKit(organizationId, brandKitId);
  const lastAsset = await prisma.brandKitAsset.findFirst({
    where: { organizationId, brandKitId, kind: input.kind },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return prisma.brandKitAsset.create({ data: { organizationId, brandKitId, ...input, order: (lastAsset?.order ?? -1) + 1 } });
}

export async function removeBrandKitAsset(organizationId: string, assetId: string) {
  await prisma.brandKitAsset.deleteMany({ where: { id: assetId, organizationId } });
}

/** Texto do kit para o prompt da IA: o que a marca é, como fala e o que tem para mostrar. */
export function buildBrandKitPrompt(kit: BrandKit): string {
  const assetsOf = (kind: BrandKitAssetKind) => kit.assets.filter((asset) => asset.kind === kind);
  const lines = [
    `Marca: ${kit.brandName || kit.organization.name}${kit.slogan ? ` — "${kit.slogan}"` : ""}`,
    kit.voiceTone && `Tom de voz: ${kit.voiceTone}`,
    kit.audience && `Público: ${kit.audience}`,
    kit.positioning && `Posicionamento: ${kit.positioning}`,
    kit.palette.length > 0 && `Cores: ${kit.palette.join(", ")}`,
    kit.fontHeading && `Fontes: títulos em ${kit.fontHeading}${kit.fontBody ? `, textos em ${kit.fontBody}` : ""}`,
    kit.keyMessages.length > 0 && `Frases da marca: ${kit.keyMessages.join(" · ")}`,
    kit.forbiddenWords.length > 0 && `Nunca use: ${kit.forbiddenWords.join(", ")}`,
    kit.defaultHashtags.length > 0 && `Hashtags da marca (use sempre, escritas exatamente assim): ${kit.defaultHashtags.map((hashtag) => `#${hashtag}`).join(" ")}`,
    kit.defaultCtas.length > 0 && `CTAs da marca: ${kit.defaultCtas.join(" · ")}`,
    kit.website && `Site: ${kit.website}`,
    `Logos disponíveis: ${Object.entries(kit.logos).filter(([, value]) => value).map(([variant]) => variant).join(", ") || "nenhum"}`,
    assetsOf("BACKGROUND").length > 0 && `Fundos disponíveis: ${assetsOf("BACKGROUND").map((asset) => asset.title).join(", ")}`,
    assetsOf("PRODUCT").length > 0 &&
      `Produtos e serviços:\n${assetsOf("PRODUCT").map((asset) => `- ${asset.title}${asset.price ? ` (${asset.price})` : ""}${asset.description ? `: ${asset.description}` : ""}`).join("\n")}`,
    assetsOf("MATERIAL").length > 0 && `Materiais: ${assetsOf("MATERIAL").map((asset) => asset.title).join(", ")}`,
    assetsOf("REFERENCE_POST").length > 0 &&
      `Posts de referência (estilo a seguir):\n${assetsOf("REFERENCE_POST").map((asset) => `- ${asset.title}${asset.description ? `: ${asset.description}` : ""}`).join("\n")}`,
  ];
  return lines.filter(Boolean).join("\n");
}
