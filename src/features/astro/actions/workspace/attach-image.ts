import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { inferTaskName, resolveSingleTask } from "./resolve-task";
import { applyImageToTask, peekPendingTaskImage, takePendingTaskImage } from "./pending-image";

// Anexa a uma demanda existente a imagem que o membro mandou pelo WhatsApp (spec 0080, RF-5 e RF-8).
// A imagem entra como anexo; vira capa quando a demanda não tem uma, ou quando a pessoa pede a troca.

const COVER_OPTIONS = [
  { label: "Trocar a capa", answer: "trocar a capa" },
  { label: "Só anexar", answer: "só anexar" },
] as const;

const inputSchema = z.object({
  taskName: z.string().trim().min(2).optional().describe("Título da demanda que recebe a imagem. Pode ser parcial."),
  coverChoice: z.string().trim().optional().describe("Resposta à pergunta da capa, quando a demanda já tem uma."),
});

export const attachImageToWorkspaceActionItem: AstroAction<typeof inputSchema> = {
  key: "action.attach_image",
  app: "workspaces",
  toolName: "attach_image_to_workspace_task",
  description:
    "ANEXA a uma demanda/tarefa que já existe a imagem que o usuário acabou de enviar — 'anexa na demanda X', " +
    "'coloca essa foto na tarefa X', 'usa como capa da demanda X'. Só funciona depois de uma imagem enviada pelo WhatsApp.",
  permission: { appKey: "workspace", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) => {
    const taskName = inferTaskName(text);
    return taskName ? { taskName } : {};
  },
  codeOnlyFields: ["coverChoice"],
  intentPatterns: [
    /\b(anexa|anexar|anexe|coloca|colocar|coloque|adiciona|adicionar|adicione|poe|bota|usa|usar|use)\b.{0,40}\b(imagem|foto|print|anexo|capa)\b.{0,40}\b(tarefa|demanda|atividade)s?\b/,
    /\b(anexa|anexar|anexe)\b.{0,30}\b(na|em|numa|nessa|a)\s+(uma\s+)?(tarefa|demanda|atividade)\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (!(await peekPendingTaskImage(ctx.sessionId))) {
      return {
        status: "error",
        title: "Sem imagem",
        description: "Não tenho nenhuma imagem sua esperando. Mande a imagem pelo WhatsApp e eu anexo na demanda.",
        appName: "Workspaces",
      };
    }

    const resolved = await resolveSingleTask({ ctx, taskName: input.taskName, question: "Em qual demanda eu anexo a imagem?" });
    if ("failure" in resolved) return resolved.failure;

    const task = await prisma.action.findUnique({
      where: { id: resolved.task.id },
      select: { id: true, title: true, workspaceId: true, attachments: true, coverImage: true },
    });
    if (!task) {
      return { status: "error", title: "Demanda não encontrada", description: "Essa demanda não existe mais.", appName: "Workspaces" };
    }

    const hasCover = Boolean(task.coverImage);
    const coverAnswer = COVER_OPTIONS.find(
      (option) => option.answer === input.coverChoice?.toLowerCase() || option.label === input.coverChoice,
    )?.answer;
    if (hasCover && !coverAnswer) {
      return {
        status: "ambiguous",
        title: "Capa",
        description: `"${task.title}" já tem capa. Troco pela imagem nova, ou só anexo?`,
        field: "coverChoice",
        options: COVER_OPTIONS.map((option) => ({ id: option.answer, label: option.label })),
        appName: "Workspaces",
        picker: { kind: "select", options: COVER_OPTIONS.map((option) => ({ ...option })) },
      };
    }

    if (dryRun) {
      return { status: "done", title: "Anexar imagem", description: `Imagem em "${task.title}".`, appName: "Workspaces" };
    }

    const image = await takePendingTaskImage(ctx.sessionId, ctx.organizationId);
    if (!image) {
      return { status: "error", title: "Sem imagem", description: "A imagem expirou. Mande de novo.", appName: "Workspaces" };
    }
    const applied = applyImageToTask({
      image,
      currentAttachments: task.attachments,
      currentCoverImage: task.coverImage,
      shouldReplaceCover: coverAnswer === "trocar a capa",
    });
    await prisma.action.update({
      where: { id: task.id },
      data: { attachments: applied.attachments, coverImage: applied.coverImage },
    });

    return {
      status: "done",
      title: "Imagem anexada",
      description: `Anexei a imagem em "${task.title}"${applied.isCoverSet ? " e defini como capa" : ""}.`,
      internalUrl: `/workspaces/${task.workspaceId}?action=${task.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};
