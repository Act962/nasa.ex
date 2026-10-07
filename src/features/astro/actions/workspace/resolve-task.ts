import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroActionResult } from "../types";
import { parsePickedAnswer } from "@/features/astro/lib/astro-picker";
import { normalizeIntent } from "./task-fields";

// Qual demanda o pedido aponta: pelo nome, pelo id do seletor ou "a última
// que criei". Editar e checklist usam a mesma resolução.

const MAX_TASK_OPTIONS = 8;
export const LAST_TASK_ANSWER = "última";
const LAST_TASK = /^(?:a\s+|essa\s+|esta\s+|minha\s+)?ultim[ao](?:\s+(?:tarefa|demanda|atividade))?(?:\s+que\s+(?:eu\s+)?criei)?$/;

const TASK_SELECT = {
  id: true,
  title: true,
  workspaceId: true,
  workspace: { select: { name: true } },
} as const;

export interface ResolvedTask {
  id: string;
  title: string;
  workspaceId: string;
  workspace: { name: string };
}

/** "da demanda Criar site", "essa última demanda que criei" → como o resolvedor entende. */
export function inferTaskName(text: string): string | undefined {
  const normalized = normalizeIntent(text);
  if (/\bultim[ao]\b/.test(normalized) || /\b(tarefa|demanda|atividade)\s+que\s+(eu\s+)?(criei|acabei de criar)\b/.test(normalized)) {
    return LAST_TASK_ANSWER;
  }
  const named = text.match(
    /\b(?:tarefa|demanda|atividade)\s+["“]?(.+?)["”]?(?=\s+(?:para|pra)\s|\s+(?:no|na|em)\s+(?:workspace|quadro)\b|,|$)/iu,
  )?.[1];
  if (!named) return undefined;
  const isGeneric = /^(de\s+)?(um|uma|algum|alguma|meu|minha|o|a)\b/.test(normalizeIntent(named));
  return isGeneric || named.trim().length < 2 ? undefined : named.trim();
}

export async function resolveSingleTask(params: {
  ctx: AgentContext;
  taskName?: string;
  /** Pergunta feita quando o pedido não disse qual demanda. */
  question: string;
}): Promise<{ task: ResolvedTask } | { failure: AstroActionResult }> {
  const { ctx } = params;
  const scope = { organizationId: ctx.organizationId, isArchived: false, workspace: { isArchived: false } };
  const picked = params.taskName ? parsePickedAnswer(params.taskName) : null;

  if (picked?.id) {
    const task = await prisma.action.findFirst({ where: { ...scope, id: picked.id }, select: TASK_SELECT });
    if (task) return { task };
  }

  if (picked && LAST_TASK.test(normalizeIntent(picked.label))) {
    const lastCreated = await prisma.action.findFirst({
      where: { ...scope, createdBy: ctx.userId },
      orderBy: { createdAt: "desc" },
      select: TASK_SELECT,
    });
    if (lastCreated) return { task: lastCreated };
  }

  const named = picked && !LAST_TASK.test(normalizeIntent(picked.label)) ? picked.label : null;
  const candidates = await prisma.action.findMany({
    where: {
      ...scope,
      ...(named
        ? { title: { contains: named, mode: "insensitive" } }
        : { OR: [{ createdBy: ctx.userId }, { responsibles: { some: { userId: ctx.userId } } }] }),
    },
    orderBy: { createdAt: "desc" },
    select: TASK_SELECT,
    take: MAX_TASK_OPTIONS,
  });

  if (candidates.length === 0) {
    const failure: AstroActionResult = named
      ? {
          status: "needs_input",
          title: "Demanda não encontrada",
          description: `Não achei demanda com "${named}". Diga o título como está no Workspace.`,
          missingFields: [{ key: "taskName", label: "o título da demanda" }],
          appName: "Workspaces",
        }
      : {
          status: "error",
          title: "Demanda não encontrada",
          description: "Não achei nenhuma demanda sua. Crie uma antes.",
          appName: "Workspaces",
        };
    return { failure };
  }

  // Título idêntico ao pedido vence os parecidos: a opção escolhida na lista
  // volta como título, e "Criar site" não pode empatar com "Criar site novo".
  const exactMatches = named
    ? candidates.filter((candidate) => normalizeIntent(candidate.title) === normalizeIntent(named))
    : [];
  if (exactMatches.length > 0) return { task: exactMatches[0] };
  if (named && candidates.length === 1) return { task: candidates[0] };

  return {
    failure: {
      status: "ambiguous",
      title: "Qual demanda?",
      description: params.question,
      field: "taskName",
      options: candidates.map((candidate) => ({ id: candidate.id, label: candidate.title })),
      appName: "Workspaces",
    },
  };
}
