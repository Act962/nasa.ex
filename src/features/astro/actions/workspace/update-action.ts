import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parseCalendarDate } from "../parse-when";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";
import { inferTaskName, resolveSingleTask } from "./resolve-task";
import {
  DAY_WORDS,
  MEMBER_PICKER,
  PRIORITY_OPTIONS,
  TIME_OF_DAY,
  findTeamMember,
  formatDay,
  hasTimeOfDay,
  normalizeIntent,
  priorityLabel,
  toPriority,
} from "./task-fields";
import { notifyNewTask } from "@/features/actions/server/lib/notify-new-task";

// Editar uma demanda que já existe (spec 0072, RF-9). Sem este verbo, "quero
// editar a última demanda" caía em `action.create` e abria uma demanda nova.
// Roteiro: qual demanda → o que mudar → dado novo.

const CHANGE_OPTIONS = [
  { label: "Título", answer: "newTitle" },
  { label: "Prazo", answer: "dueAnswer" },
  { label: "Responsável", answer: "responsibleName" },
  { label: "Prioridade", answer: "priorityName" },
] as const;

type ChangeField = (typeof CHANGE_OPTIONS)[number]["answer"];

const NEW_VALUE_PICKERS: Record<ChangeField, AstroPicker> = {
  newTitle: { kind: "text", placeholder: "Novo título", maxLength: 200 },
  dueAnswer: { kind: "datetime", mode: "date" },
  responsibleName: MEMBER_PICKER,
  priorityName: { kind: "select", options: PRIORITY_OPTIONS.map((option) => ({ ...option })) },
};

const inputSchema = z.object({
  taskName: z.string().trim().min(2).optional().describe("Título da demanda a editar. Pode ser parcial."),
  newTitle: z.string().trim().min(2).max(200).optional().describe("Novo título da demanda."),
  dueAnswer: z.string().trim().optional().describe("Novo prazo, com as palavras do usuário."),
  responsibleName: z.string().trim().optional().describe("Novo responsável."),
  priorityName: z.string().trim().optional().describe("Nova prioridade."),
  fieldToChange: z.string().trim().optional().describe("Campo escolhido no roteiro."),
  newValue: z.string().trim().optional().describe("Dado novo informado no roteiro."),
});

/** "muda o prazo da demanda Criar site para sexta às 10h" → campos, sem modelo. */
function inferUpdateFields(text: string): Record<string, unknown> {
  const normalized = normalizeIntent(text);
  const inferred: Record<string, unknown> = {};
  const taskName = inferTaskName(text);
  if (taskName) inferred.taskName = taskName;

  if (/\b(prazo|data|vencimento|entrega)\b/.test(normalized)) {
    const due = text.match(
      new RegExp(`\\b(?:para|pra|ate|até)\\s+((?:${DAY_WORDS}|dia\\s+\\d{1,2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)${TIME_OF_DAY})`, "iu"),
    )?.[1];
    if (due) inferred.dueAnswer = due.trim();
  }
  const priority = normalized.match(/\bprioridade\b.*?\b(alta|media|baixa|urgente)\b|\b(urgente)\b/);
  if (priority) inferred.priorityName = priority[1] ?? priority[2];
  const responsible = text.match(
    /\brespons[aá]vel\b.*?\b(?:para|pra|e|é)\s+(?:o\s+|a\s+)?([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)*)/u,
  )?.[1];
  if (responsible) inferred.responsibleName = responsible;
  const newTitle = text.match(/\b(?:t[ií]tulo|nome)\b.*?\b(?:para|pra)\s+["“]?(.+?)["”]?\s*$/iu)?.[1];
  if (newTitle && newTitle.trim().length >= 2) inferred.newTitle = newTitle.trim();
  return inferred;
}

export const updateWorkspaceActionItem: AstroAction<typeof inputSchema> = {
  key: "action.update",
  app: "workspaces",
  toolName: "update_workspace_task",
  description:
    "EDITA uma demanda/tarefa que já existe — 'muda o prazo da demanda X para sexta', 'altera o título da tarefa X', " +
    "'troca o responsável da demanda X', 'editar a última demanda que criei'. Não cria demanda nova.",
  permission: { appKey: "workspace", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: inferUpdateFields,
  codeOnlyFields: ["fieldToChange", "newValue"],
  intentPatterns: [
    /^(?!.*\b(checklist|check-list|subtarefas?|sub-tarefas?|subitem)\b).*\b(edita|editar|edite|altera|alterar|altere|muda|mudar|mude|atualiza|atualizar|atualize|corrige|corrigir|corrija|renomeia|renomear|renomeie|troca|trocar|troque)\b.{0,40}\b(tarefa|demanda|atividade)s?\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTask({ ctx, taskName: input.taskName, question: "Qual demanda você quer editar?" });
    if ("failure" in resolved) return resolved.failure;
    const task = resolved.task;

    const requested: Partial<Record<ChangeField, string>> = {
      newTitle: input.newTitle,
      dueAnswer: input.dueAnswer,
      responsibleName: input.responsibleName,
      priorityName: input.priorityName,
    };
    const hasInlineChange = Object.values(requested).some(Boolean);
    if (!hasInlineChange) {
      const fieldToChange = CHANGE_OPTIONS.find(
        (option) => option.answer === input.fieldToChange || option.label === input.fieldToChange,
      )?.answer;
      if (!fieldToChange) {
        return {
          status: "ambiguous",
          title: "O que mudar?",
          description: `O que você quer mudar em "${task.title}"?`,
          field: "fieldToChange",
          options: CHANGE_OPTIONS.map((option) => ({ id: option.answer, label: option.label })),
          appName: "Workspaces",
          picker: { kind: "select", options: CHANGE_OPTIONS.map((option) => ({ ...option })) },
        };
      }
      if (!input.newValue) {
        const fieldLabel = CHANGE_OPTIONS.find((option) => option.answer === fieldToChange)!.label;
        return {
          status: "needs_input",
          title: fieldLabel,
          description: `${fieldLabel} de "${task.title}": informe o dado novo.`,
          missingFields: [{ key: "newValue", label: fieldLabel.toLowerCase() }],
          appName: "Workspaces",
          picker: NEW_VALUE_PICKERS[fieldToChange],
        };
      }
      requested[fieldToChange] = input.newValue;
    }

    const changes: { title?: string; dueDate?: Date; priority?: (typeof PRIORITY_OPTIONS)[number]["answer"] } = {};
    let newResponsibleId: string | null = null;
    const described: string[] = [];
    // Dado que não serve volta como pergunta no mesmo campo de onde veio.
    const retryField = hasInlineChange ? null : "newValue";

    if (requested.newTitle) {
      changes.title = requested.newTitle;
      described.push(`título → "${requested.newTitle}"`);
    }
    if (requested.dueAnswer) {
      const dueIso = parseCalendarDate(requested.dueAnswer);
      if (!dueIso) {
        return {
          status: "needs_input",
          title: "Prazo",
          description: `Não entendi "${requested.dueAnswer}" como data. Qual o novo prazo?`,
          missingFields: [{ key: retryField ?? "dueAnswer", label: "o prazo" }],
          appName: "Workspaces",
          picker: NEW_VALUE_PICKERS.dueAnswer,
        };
      }
      changes.dueDate = new Date(dueIso);
      described.push(`prazo → ${formatDay(changes.dueDate, hasTimeOfDay(requested.dueAnswer))}`);
    }
    if (requested.priorityName) {
      const priority = toPriority(requested.priorityName);
      if (!priority) {
        return {
          status: "needs_input",
          title: "Prioridade",
          description: `Não sei o que é "${requested.priorityName}". Qual a prioridade?`,
          missingFields: [{ key: retryField ?? "priorityName", label: "a prioridade" }],
          appName: "Workspaces",
          picker: NEW_VALUE_PICKERS.priorityName,
        };
      }
      changes.priority = priority;
      described.push(`prioridade → ${priorityLabel(priority)}`);
    }
    if (requested.responsibleName) {
      const responsible = await findTeamMember(ctx, requested.responsibleName);
      if (!responsible) {
        return {
          status: "needs_input",
          title: "Responsável não encontrado",
          description: `Não achei "${requested.responsibleName}" na equipe. Quem fica responsável?`,
          missingFields: [{ key: retryField ?? "responsibleName", label: "o responsável" }],
          appName: "Workspaces",
          picker: MEMBER_PICKER,
        };
      }
      newResponsibleId = responsible.id;
      described.push(`responsável → ${responsible.name}`);
    }

    const summary = `"${task.title}" em ${task.workspace.name}: ${described.join(", ")}.`;
    if (dryRun) {
      return { status: "done", title: "Editar demanda", description: summary, appName: "Workspaces" };
    }

    await prisma.action.update({
      where: { id: task.id },
      data: {
        ...changes,
        ...(newResponsibleId
          ? { responsibles: { deleteMany: {}, create: { userId: newResponsibleId } } }
          : {}),
      },
    });

    if (newResponsibleId) {
      await notifyNewTask({
        actionId: task.id,
        title: changes.title ?? task.title,
        workspaceId: task.workspaceId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        userIds: [newResponsibleId],
      });
    }

    return {
      status: "done",
      title: "Demanda atualizada",
      description: summary,
      internalUrl: `/workspaces/${task.workspaceId}?action=${task.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};
