/** Regra única de completude do Kit da Marca (spec 0063, RF-2/D-3): tela, trava do gerar e Astro usam esta função. */

export interface BrandKitCompletenessInput {
  logos: Partial<Record<BrandLogoVariant, string | null>>;
  palette: string[];
  fontHeading: string | null;
  voiceTone: string | null;
  audience: string | null;
  positioning: string | null;
  website: string | null;
  productCount: number;
  materialCount: number;
  referencePostCount: number;
}

export const BRAND_LOGO_VARIANTS = ["color", "black", "white", "icon", "horizontal"] as const;
export type BrandLogoVariant = (typeof BRAND_LOGO_VARIANTS)[number];

export const BRAND_LOGO_LABEL: Record<BrandLogoVariant, string> = {
  color: "colorida",
  black: "preta",
  white: "branca",
  icon: "ícone",
  horizontal: "horizontal",
};

export interface BrandKitCompleteness {
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  missing: string[];
}

export function computeBrandKitCompleteness(kit: BrandKitCompletenessInput): BrandKitCompleteness {
  const missingLogoVariants = (["white", "black"] as const).filter((variant) => !kit.logos[variant]);
  const checks: Array<{ isDone: boolean; missingLabel: string }> = [
    { isDone: Boolean(kit.logos.color), missingLabel: "logo colorida" },
    { isDone: missingLogoVariants.length === 0, missingLabel: `logo em ${missingLogoVariants.map((variant) => BRAND_LOGO_LABEL[variant]).join(" e ")}` },
    { isDone: kit.palette.length >= 2, missingLabel: "2 cores ou mais" },
    { isDone: Boolean(kit.fontHeading), missingLabel: "fonte de título" },
    { isDone: Boolean(kit.voiceTone?.trim()), missingLabel: "tom de voz" },
    { isDone: Boolean(kit.audience?.trim() || kit.positioning?.trim()), missingLabel: "público ou posicionamento" },
    { isDone: kit.productCount > 0, missingLabel: "produtos e serviços" },
    { isDone: Boolean(kit.website?.trim()) || kit.materialCount > 0, missingLabel: "site ou material" },
    { isDone: kit.referencePostCount > 0, missingLabel: "posts de referência" },
  ];
  const completedCount = checks.filter((check) => check.isDone).length;
  return {
    completedCount,
    totalCount: checks.length,
    isComplete: completedCount === checks.length,
    missing: checks.filter((check) => !check.isDone).map((check) => check.missingLabel),
  };
}
