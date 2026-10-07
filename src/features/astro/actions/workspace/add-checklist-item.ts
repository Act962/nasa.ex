import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { inferTaskName, resolveSingleTask } from "./resolve-task";
import { normalizeIntent } from "./task-fields";

// Item de checklist (subtarefa) dentro de uma demanda (spec 0072, RF-10). Sem
// este verbo, "adicionar um item no checklist" criava uma demanda chamada
// "Item no checklist". Roteiro: item → qual demanda.

const CHECKLIST_WORDS = "checklist|check-list|subtarefas?|sub-tarefas?|subitem|subitens";

const inputSchema = z.object({
  itemTitle: z.string().trim().min(2).max(200).describe("O item do checklist, ex: 'Revisar orçamento'."),
  taskName: z.string().trim().min(2).optional().describe("Título da demanda que recebe o item. Pode ser parcial."),
});

/** `adiciona o item "revisar orçamento" no checklist da demanda Criar site` → campos, sem modelo. */
function inferChecklistFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const quotedItem = text.match(/["“]([^"”]{2,200})["”]/u)?.[1];
  const looseItem = text.match(
    new RegExp(`\\b(?:item|subtarefa|sub-tarefa|subitem)\\s+(?:de\\s+)?(.+?)(?=\\s+(?:no|na|ao|a|em)\\s+(?:${CHECKLIST_WORDS}|tarefa|demanda|atividade)\\b|,|$)`, "iu"),
  )?.[1];
  const itemTitle = (quotedItem ?? looseItem)?.trim();
  const isGenericItem = itemTitle ? /^(no|na|ao|em|de|do|da|para|pra)\b/.test(normalizeIntent(itemTitle)) : true;
  if (itemTitle && itemTitle.length >= 2 && !isGenericItem) inferred.itemTitle = itemTitle;

  // O título entre aspas é o item; a demanda vem depois de "da demanda".
  const taskName = inferTaskName(quotedItem ? text.replace(/["“][^"”]*["”]/u, "") : text);
  if (taskName) inferred.taskName = taskName;
  return inferred;
}

export const addChecklistItemAction: AstroAction<typeof inputSchema> = {
  key: "action.add_checklist_item",
  app: "workspaces",
  toolName: "add_workspace_task_checklist_item",
  description:
    "Adiciona um ITEM DE CHECKLIST (subtarefa) dentro de uma demanda que já existe — 'adiciona o item X no checklist da demanda Y', " +
    "'nova subtarefa X na tarefa Y'. Não cria demanda nova.",
  permission: { appKey: "workspace", action: "edit" },
  requiresConfirmation: false,
  newNameFields: ["itemTitle"],
  input: inputSchema,
  inferFields: inferChecklistFields,
  intentPatterns: [
    new RegExp(
      `\\b(adiciona|adicionar|adicione|cria|criar|crie|inclui|incluir|inclua|coloca|colocar|coloque|poe|bota|novo|nova)\\b.{0,60}\\b(${CHECKLIST_WORDS})\\b`,
    ),
  ],
  fieldSteps: {
    itemTitle: {
      title: "Qual o item?",
      question: "Qual item entra no checklist?",
      picker: { kind: "text", placeholder: "Ex.: Revisar orçamento", maxLength: 200 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTask({
      ctx,
      taskName: input.taskName,
      question: "Em qual demanda eu coloco o item?",
    });
    if ("failure" in resolved) return resolved.failure;
    const task = resolved.task;
    const summary = `"${input.itemTitle}" no checklist de "${task.title}", em ${task.workspace.name}.`;

    if (dryRun) {
      return { status: "done", title: "Adicionar item ao checklist", description: summary, appName: "Workspaces" };
    }

    const lastItem = await prisma.subActions.findFirst({
      where: { actionId: task.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await prisma.subActions.create({
      data: { title: input.itemTitle, actionId: task.id, order: lastItem ? lastItem.order + 1 : 0 },
    });

    return {
      status: "done",
      title: "Item adicionado",
      description: summary,
      internalUrl: `/workspaces/${task.workspaceId}?action=${task.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};
