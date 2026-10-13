/** Tipos, catálogo de modelos de imagem e endereço de mídia usados pelas abas do popup do Planner. */

export interface ActionContext {
  actionId: string;
  title: string;
  description: string | null;
  attachmentUrls: string[];
}

export type ImageModel =
  | "ideogram_quality"
  | "ideogram_balanced"
  | "ideogram_turbo"
  | "dalle3_hd"
  | "dalle3_standard"
  | "pollinations";

export interface ModelInfo {
  value: ImageModel;
  label: string;
  stars: number;
  hint: string;
}

export const MODEL_CATALOG: ModelInfo[] = [
  {
    value: "ideogram_quality",
    label: "Ideogram 3.0 Quality",
    stars: 6,
    hint: "Melhor pra cards com TIPOGRAFIA legível. Recomendado pra publicação.",
  },
  {
    value: "ideogram_balanced",
    label: "Ideogram 3.0 Balanced",
    stars: 4,
    hint: "Padrão — bom custo-benefício pra iteração.",
  },
  {
    value: "ideogram_turbo",
    label: "Ideogram 3.0 Turbo",
    stars: 3,
    hint: "Rápido (~5s). Bom pra brainstorming.",
  },
  {
    value: "dalle3_hd",
    label: "DALL-E 3 HD",
    stars: 5,
    hint: "Bom pra fotos/cenas realistas. Tipografia inconsistente.",
  },
  {
    value: "dalle3_standard",
    label: "DALL-E 3 Standard",
    stars: 3,
    hint: "Fallback OK quando Ideogram não disponível.",
  },
  {
    value: "pollinations",
    label: "Pollinations (gratuito)",
    stars: 1,
    hint: "Grátis, qualidade inconsistente. Último recurso.",
  },
];

export function resolveR2Url(key: string): string {
  if (/^https?:\/\//i.test(key)) return key;
  const publicUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
  if (publicUrl) return `${publicUrl}/${key}`;
  if (bucket) return `https://${bucket}.r2.dev/${key}`;
  return key;
}
