import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { periodFrom } from "@/features/astro/queries/types";
import {
  markActionDone,
  runCompletedEffectsInSequence,
  type ActionCompletionActor,
} from "@/features/actions/server/lib/complete-action";
import { inferTaskName, resolveSingleTask } from "./resolve-task";
import { normalizeIntent, taskPrioritiesFrom } from "./task-fields";

// Concluir demanda pelo Astro (spec 0078): uma pelo nome, ou várias por filtro ("as do mês
// passado", "as atrasadas"). Em lote só entram as de quem pediu, e nada muda antes do "confirmar".

const MAX_BATCH_SIZE = 50;
const MAX_TITLES_SHOWN = 10;
const SINGLE_TASK_NOUN = /\b(tarefa|demanda|atividade)\b/;
const OVERDUE = /\b(atrasadas?|vencidas?)\b/;
const COMPLETION_VERB = /\b(conclu|finaliz|encerr|marc)/;

const inputSchema = z.object({
  taskName: z.string().trim().min(2).optional().describe("Título da demanda a concluir. Pode ser parcial."),
  batchRequest: z.string().trim().optional().describe("Frase do pedido em lote, com o filtro dito pelo usuário."),
});

/** Sem "a tarefa X" no singular, o pedido é em lote e o filtro sai da própria frase. */
function inferCompletionFields(text: string): Record<string, unknown> {
  if (!SINGLE_TASK_NOUN.test(normalizeIntent(text))) return { batchRequest: text };
  const taskName = inferTaskName(text);
  return taskName ? { taskName } : {};
}

function listTitles(titles: string[], total: number): string {
  const shown = titles.slice(0, MAX_TITLES_SHOWN).map((title) => `"${title}"`).join(", ");
  const hiddenCount = total - Math.min(titles.length, MAX_TITLES_SHOWN);
  return hiddenCount > 0 ? `${shown} e mais ${hiddenCount}` : shown;
}

async function loadActor(ctx: AgentContext): Promise<ActionCompletionActor | null> {
  return prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, name: true, email: true, image: true },
  });
}

async function completeBatch(params: {
  ctx: AgentContext;
  batchRequest: string;
  dryRun?: boolean;
}): Promise<AstroActionResult> {
  const { ctx } = params;
  // "Traga as de alta prioridade e finalize as do mês passado": o filtro da conclusão começa no verbo dela.
  const wholeRequest = normalizeIntent(params.batchRequest);
  const normalized = wholeRequest.slice(Math.max(0, wholeRequest.search(COMPLETION_VERB)));
  const period = periodFrom(normalized);
  const onlyOverdue = OVERDUE.test(normalized);
  const priority = taskPrioritiesFrom(normalized);

  if (!period && !onlyOverdue && !priority) {
    return {
      status: "error",
      title: "Quais tarefas?",
      description:
        'Diga quais concluir: pelo nome ("conclui a tarefa Revisar contrato") ou por um filtro, como "as atrasadas", "as do mês passado" ou "as de alta prioridade".',
      appName: "Workspaces",
    };
  }

  const where = {
    organizationId: ctx.organizationId,
    isArchived: false,
    isDone: false,
    workspace: { isArchived: false },
    responsibles: { some: { userId: ctx.userId } },
    ...(priority ? { priority: { in: priority.priorities } } : {}),
    ...(period
      ? { dueDate: { gte: period.since, lt: period.until } }
      : onlyOverdue
        ? { dueDate: { lt: new Date() } }
        : {}),
  };
  const filterLabel = [
    priority?.label,
    period ? `com prazo ${period.label}` : null,
    onlyOverdue && !period ? "atrasadas" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const [total, tasks] = await Promise.all([
    prisma.action.count({ where }),
    prisma.action.findMany({
      where,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      select: { id: true, title: true },
      take: MAX_BATCH_SIZE,
    }),
  ]);

  if (total === 0) {
    return {
      status: "error",
      title: "Nada para concluir",
      description: `Não achei tarefa sua em aberto ${filterLabel}.`,
      appName: "Workspaces",
    };
  }

  const leftOver = total - tasks.length;
  const leftOverNote =
    leftOver > 0 ? ` São ${total} no total: concluo as ${tasks.length} de prazo mais antigo e ficam ${leftOver}.` : "";
  const titles = listTitles(tasks.map((task) => task.title), tasks.length);

  if (params.dryRun) {
    return {
      status: "done",
      title: tasks.length === 1 ? "Concluir 1 tarefa" : `Concluir ${tasks.length} tarefas`,
      description: `Suas tarefas em aberto ${filterLabel}: ${titles}.${leftOverNote}`,
      appName: "Workspaces",
    };
  }

  const actor = await loadActor(ctx);
  if (!actor) {
    return { status: "error", title: "Não foi possível concluir", description: "Não achei o seu usuário.", appName: "Workspaces" };
  }
  const completed = [];
  for (const task of tasks) {
    const done = await markActionDone({ actionId: task.id, organizationId: ctx.organizationId });
    if (done) completed.push(done);
  }
  const completedCount = completed.length;
  // Pontos, automação e registro de cada tarefa não seguram a resposta: 50 tarefas levariam minutos.
  void runCompletedEffectsInSequence({ actions: completed, organizationId: ctx.organizationId, actor });

  return {
    status: "done",
    title: completedCount === 1 ? "1 tarefa concluída" : `${completedCount} tarefas concluídas`,
    description: `Concluí ${titles}.${leftOver > 0 ? ` Ainda ficaram ${leftOver} em aberto nesse filtro.` : ""}`,
    internalUrl: "/workspaces",
    openLabel: "Abrir Workspaces",
    appName: "Workspaces",
  };
}

export const completeWorkspaceActionItem: AstroAction<typeof inputSchema> = {
  key: "action.complete",
  app: "workspaces",
  toolName: "complete_workspace_task",
  description:
    "CONCLUI demandas/tarefas — 'conclui a tarefa X', 'finaliza a demanda X', 'marca a tarefa X como concluída'. " +
    "Também em lote, por filtro: 'finalize as do mês passado', 'conclua as tarefas atrasadas'. Não edita nem cria.",
  permission: { appKey: "workspace", action: "edit" },
  requiresConfirmation: true,
  input: inputSchema,
  inferFields: inferCompletionFields,
  codeOnlyFields: ["batchRequest"],
  intentPatterns: [
    /^(?!.*\b(checklist|check-list|subtarefas?|sub-tarefas?|subitem)\b).*\b(conclui|concluir|conclua|finaliza|finalizar|finalize|encerra|encerrar|encerre)\b.{0,60}\b(tarefa|demanda|atividade)s?\b/,
    /^(?!.*\b(propostas?|leads?|conversas?|atendimentos?|chats?|checklist)\b).*\b(conclui|concluir|conclua|finaliza|finalizar|finalize)\s+(as|todas|minhas|essas|aquelas)\b/,
    /\b(marca|marcar|marque)\b.{0,50}\b(tarefa|demanda|atividade)s?\b.{0,60}\b(concluida|feita|finalizada|pronta)s?\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (input.batchRequest && !input.taskName) {
      return completeBatch({ ctx, batchRequest: input.batchRequest, dryRun });
    }

    const resolved = await resolveSingleTask({ ctx, taskName: input.taskName, question: "Qual demanda você quer concluir?" });
    if ("failure" in resolved) return resolved.failure;
    const task = resolved.task;

    if (dryRun) {
      return {
        status: "done",
        title: "Concluir tarefa",
        description: `"${task.title}" em ${task.workspace.name}.`,
        appName: "Workspaces",
      };
    }

    const actor = await loadActor(ctx);
    if (!actor) {
      return { status: "error", title: "Não foi possível concluir", description: "Não achei o seu usuário.", appName: "Workspaces" };
    }
    const done = await markActionDone({ actionId: task.id, organizationId: ctx.organizationId });
    const wasCompleted = Boolean(done);
    if (done) void runCompletedEffectsInSequence({ actions: [done], organizationId: ctx.organizationId, actor });
    return {
      status: "done",
      title: wasCompleted ? "Tarefa concluída" : "Já estava concluída",
      description: wasCompleted ? `"${task.title}" foi concluída.` : `"${task.title}" já estava concluída.`,
      internalUrl: `/workspaces/${task.workspaceId}?action=${task.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};
