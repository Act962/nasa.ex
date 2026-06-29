import type { EventCategory } from "@/generated/prisma/enums";

export const EVENT_CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: "WORKSHOP",     label: "Workshop",     emoji: "🛠️" },
  { value: "PALESTRA",     label: "Palestra",     emoji: "🎤" },
  { value: "LANCAMENTO",   label: "Lançamento",   emoji: "🚀" },
  { value: "WEBINAR",      label: "Webinar",      emoji: "💻" },
  { value: "NETWORKING",   label: "Networking",   emoji: "🤝" },
  { value: "CURSO",        label: "Curso",        emoji: "📚" },
  { value: "REUNIAO",      label: "Reunião",      emoji: "👥" },
  { value: "HACKATHON",    label: "Hackathon",    emoji: "💡" },
  { value: "CONFERENCIA",  label: "Conferência",  emoji: "🎯" },
  { value: "OUTRO",        label: "Outro",        emoji: "✨" },
];

export function getCategoryMeta(value: EventCategory | string | null | undefined) {
  if (!value) return null;
  return EVENT_CATEGORIES.find((c) => c.value === value) ?? null;
}

export const BR_STATES: { value: string; label: string }[] = [
  { value: "AC", label: "Acre" },           { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },          { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },          { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal"},{ value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },          { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },    { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },   { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },        { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },     { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" }, { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },{ value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },        { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },      { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];
