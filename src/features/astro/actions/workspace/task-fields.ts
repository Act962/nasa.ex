import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

// Leitura dos campos de uma demanda, compartilhada por criar, editar e checklist.

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
export const MYSELF_ANSWER = "eu mesmo";

export const PRIORITY_OPTIONS = [
  { label: "Sem prioridade", answer: "NONE" },
  { label: "Baixa", answer: "LOW" },
  { label: "Média", answer: "MEDIUM" },
  { label: "Alta", answer: "HIGH" },
  { label: "Urgente", answer: "URGENT" },
] as const;

export type ActionPriority = (typeof PRIORITY_OPTIONS)[number]["answer"];

const PRIORITY_WORDS: Record<string, ActionPriority> = {
  urgente: "URGENT",
  alta: "HIGH",
  media: "MEDIUM",
  baixa: "LOW",
  nenhuma: "NONE",
  sem: "NONE",
};

export const MEMBER_PICKER: AstroPicker = {
  kind: "entity",
  entity: "member",
  placeholder: "Buscar pessoa da equipe",
  noneOption: { label: "Eu mesmo", answer: MYSELF_ANSWER },
};

export const DAY_WORDS =
  "amanha|amanhã|hoje|depois de amanha|depois de amanhã|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo";
export const TIME_OF_DAY = "(?:\\s+(?:as|às)?\\s*\\d{1,2}\\s*(?:h(?:oras?)?\\s*\\d{0,2}|:\\d{2}))?";

export function normalizeIntent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function toPriority(raw: string): ActionPriority | null {
  const normalized = normalizeIntent(raw.trim());
  const byAnswer = PRIORITY_OPTIONS.find((option) => option.answer.toLowerCase() === normalized);
  if (byAnswer) return byAnswer.answer;
  const word = Object.keys(PRIORITY_WORDS).find((key) => new RegExp(`\\b${key}\\b`).test(normalized));
  return word ? PRIORITY_WORDS[word] : null;
}

export function priorityLabel(priority: ActionPriority): string {
  return PRIORITY_OPTIONS.find((option) => option.answer === priority)!.label.toLowerCase();
}

/** Resposta em palavras com hora ("hoje às 18h"); data ISO do seletor não conta. */
export function hasTimeOfDay(dueAnswer: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}/.test(dueAnswer.trim())) return false;
  return /\b\d{1,2}\s*(?:h\b|h\d{2}|:\d{2}|horas?\b)/i.test(dueAnswer);
}

export function formatDay(date: Date, hasTime: boolean): string {
  const day = date.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  if (!hasTime) return day;
  const time = date.toLocaleTimeString("pt-BR", { timeZone: BRAZIL_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

/** Pessoa da equipe pelo nome dito, pelo id do seletor ou "eu mesmo". */
export async function findTeamMember(
  ctx: AgentContext,
  spokenName: string,
): Promise<{ id: string; name: string } | null> {
  const picked = parsePickedAnswer(spokenName);
  if (normalizeIntent(picked.label) === MYSELF_ANSWER) {
    return prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, name: true } });
  }
  return prisma.user.findFirst({
    where: {
      members: { some: { organizationId: ctx.organizationId } },
      ...(picked.id ? { id: picked.id } : { name: { contains: picked.label, mode: "insensitive" } }),
    },
    select: { id: true, name: true },
  });
}
