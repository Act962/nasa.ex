export const POST_TYPE_OPTIONS = [
  { value: "STATIC", label: "Imagem" },
  { value: "CAROUSEL", label: "Carrossel" },
  { value: "REEL", label: "Reel" },
  { value: "STORY", label: "Story" },
] as const;

export type PostTypeValue = (typeof POST_TYPE_OPTIONS)[number]["value"];

export const POST_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  POST_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);
