/**
 * Público-alvo do wizard, em dimensões que Meta e Google permitem segmentar.
 *
 * O catálogo é deliberadamente neutro: não há saúde, religião, orientação
 * sexual, etnia ou política — segmentações sensíveis proibidas nas duas
 * plataformas. Quem anuncia imóveis, emprego ou crédito cai em "categoria
 * especial", e aí a própria Meta bloqueia gênero, idade e raio pequeno.
 */

export type AudienceDimension = "gender" | "age" | "location" | "interest";

export interface AudienceChip {
  dimension: AudienceDimension;
  value: string;
}

export interface AudienceDimensionSpec {
  id: AudienceDimension;
  label: string;
  /** Escolha de uma lista fixa ou texto livre (localização). */
  kind: "options" | "text";
  options?: string[];
  placeholder?: string;
  /** Bloqueado quando o anúncio é de categoria especial. */
  blockedBySpecialCategory: boolean;
  /** Quantos chips desta dimensão o cliente pode somar. */
  max: number;
}

export const AUDIENCE_DIMENSIONS: AudienceDimensionSpec[] = [
  {
    id: "gender",
    label: "Gênero",
    kind: "options",
    options: ["Todos", "Mulheres", "Homens"],
    blockedBySpecialCategory: true,
    max: 1,
  },
  {
    id: "age",
    label: "Idade",
    kind: "options",
    options: [
      "18 a 24 anos",
      "25 a 34 anos",
      "25 a 45 anos",
      "35 a 54 anos",
      "45 a 65+ anos",
      "Todas as idades",
    ],
    blockedBySpecialCategory: true,
    max: 1,
  },
  {
    id: "location",
    label: "Localização",
    kind: "text",
    placeholder: "Cidade, bairro ou região",
    blockedBySpecialCategory: false,
    max: 5,
  },
  {
    id: "interest",
    label: "Interesses",
    kind: "options",
    options: [
      "Alimentação e bebidas",
      "Moda e beleza",
      "Casa e decoração",
      "Fitness e esportes",
      "Tecnologia",
      "Viagens",
      "Pets",
      "Educação e cursos",
      "Negócios e empreendedorismo",
      "Veículos",
      "Imóveis",
      "Serviços locais",
      "Eventos e festas",
      "Família e filhos",
    ],
    blockedBySpecialCategory: false,
    max: 6,
  },
];

/**
 * Categorias especiais da Meta (e "conteúdo restrito" no Google). Quando o
 * anúncio é sobre um destes temas, a plataforma proíbe segmentar por gênero,
 * idade e raio pequeno — é lei antidiscriminação, não escolha nossa.
 */
export const SPECIAL_AD_CATEGORIES = [
  { id: "none", label: "Nenhum desses" },
  { id: "housing", label: "Imóveis (venda ou aluguel)" },
  { id: "employment", label: "Vagas de emprego" },
  { id: "credit", label: "Crédito ou financiamento" },
  { id: "social", label: "Temas sociais, eleições ou política" },
] as const;

export type SpecialAdCategory = (typeof SPECIAL_AD_CATEGORIES)[number]["id"];

export function dimensionSpec(id: AudienceDimension): AudienceDimensionSpec {
  return AUDIENCE_DIMENSIONS.find((dimension) => dimension.id === id)!;
}

export function isDimensionAvailable(
  spec: AudienceDimensionSpec,
  chips: AudienceChip[],
  specialCategory: SpecialAdCategory,
): boolean {
  if (specialCategory !== "none" && spec.blockedBySpecialCategory) return false;
  return chips.filter((chip) => chip.dimension === spec.id).length < spec.max;
}

/** Resumo legível — é o que a equipe lê no card e no briefing. */
export function summarizeAudience(
  chips: AudienceChip[],
  specialCategory: SpecialAdCategory,
  freeText?: string,
): string {
  const parts = AUDIENCE_DIMENSIONS.map((spec) => {
    const values = chips
      .filter((chip) => chip.dimension === spec.id)
      .map((chip) => chip.value);
    return values.length > 0 ? `${spec.label}: ${values.join(", ")}` : null;
  }).filter(Boolean) as string[];

  if (freeText?.trim()) parts.push(`Outros: ${freeText.trim()}`);

  if (specialCategory !== "none") {
    const label = SPECIAL_AD_CATEGORIES.find((item) => item.id === specialCategory)?.label;
    parts.push(`Categoria especial: ${label} — sem segmentação por gênero/idade`);
  }

  return parts.join(" · ");
}
