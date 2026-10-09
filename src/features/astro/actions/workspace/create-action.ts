import "server-only";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parseCalendarDate } from "../parse-when";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";
import {
  DAY_WORDS,
  MEMBER_PICKER,
  PRIORITY_OPTIONS,
  PRIORITY_PICKER_OPTIONS,
  TIME_OF_DAY,
  findTeamMember,
  formatDay,
  hasTimeOfDay,
  normalizeIntent,
  toPriority,
} from "./task-fields";
import { notifyNewTask } from "@/features/actions/server/lib/notify-new-task";
import { applyImageToTask, takePendingTaskImage } from "./pending-image";

// Criar demanda/tarefa dentro de um workspace. Sem este verbo, "adicione a
// demanda CRIAR SITE dentro de DEMANDAS" caía em `workspace.create` e
// respondia que o workspace já existia — o buraco de verbo ausente de novo.
// Roteiro (spec 0033, RF-9; spec 0080): título → workspace → prazo → responsável →
// prioridade → descrição, cada passo com o seu seletor.

const NO_DEADLINE_ANSWER = "sem prazo";
const NO_DESCRIPTION_ANSWER = "sem descrição";

const inputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe("O que precisa ser feito, ex: 'Criar site'."),
  workspaceName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Workspace onde a demanda entra. Sem isso, usa o único."),
  dueAnswer: z.string().trim().optional().describe("Prazo dito na frase ou escolhido no roteiro."),
  responsibleName: z.string().trim().optional().describe("Responsável escolhido no roteiro."),
  priorityName: z.string().trim().optional().describe("Prioridade dita ou escolhida."),
  participantNames: z.string().trim().optional().describe("Participantes ditos na frase, separados por vírgula ou 'e'."),
  descriptionAnswer: z.string().trim().max(4000).optional().describe("Descrição escrita no roteiro, ou 'sem descrição'."),
});

// "com essa foto: Trocar banner" (legenda de imagem no WhatsApp) e "com o título X": o que sobra é o título.
const TITLE_LEAD_IN =
  /^(?:com\s+(?:essa|esta|a)\s+(?:foto|imagem|print)\s*[:,-]?\s*)?(?:(?:com\s+o\s+(?:t[ií]tulo|nome)|chamad[ao]|intitulad[ao]|de\s+nome)\s*:?\s*)?/iu;

// Depois de "demanda" pode vir o prazo, o workspace ou os participantes em vez do título:
// "criar uma demanda para hoje até às 18h" virava a demanda "hoje até às 18h". Sem título, o roteiro pergunta.
const NOT_A_TITLE = `\\s+(?:(?:para|pra|ate|até)\\s+(?:${DAY_WORDS}|dia\\s+\\d|\\d{1,2}\\/\\d{1,2})|(?:no|na|em)\\s+(?:workspace|quadro)\\b|com\\s+(?:os\\s+|as\\s+)?participantes?\\b|(?:onde|cujo|com)\\s+(?:o\\s+|a\\s+)?(?:respons|prioridade))`;

/** "cria a tarefa revisar contrato no workspace Operação para amanhã, urgente" → campos, sem modelo. */
function inferTaskFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  // Título entre aspas é citação: vale inteiro, com vírgula e tudo. Sem isto,
  // "Cobrar STARs no Planner, criação e publicação" era cortado na vírgula.
  const quotedTitle = text.match(/["“]([^"”]{2,200})["”]/u)?.[1];
  const looseTitle = text.match(
    new RegExp(
      `\\b(?:tarefa|demanda|atividade)(?!${NOT_A_TITLE})\\s*:?\\s+(?:de\\s+|para\\s+)?(.+?)(?=\\s+(?:no|na|em)\\s+(?:workspace|quadro)\\b|\\s+com\\s+(?:os\\s+|as\\s+)?participantes?\\b|\\s+(?:para|pra|ate|até)\\s+(?:${DAY_WORDS}|dia\\s+\\d|\\d{1,2}\\/\\d{1,2})|,|$)`,
      "iu",
    ),
  )?.[1];
  const title = (quotedTitle ?? looseTitle?.replace(TITLE_LEAD_IN, ""))?.trim();
  if (title && title.length >= 2) inferred.title = title;
  // Sem a flag "i": a continuação do nome exige inicial maiúscula, senão
  // "Operação para amanhã" virava o nome do workspace.
  const workspaceName = text.match(/\b(?:no|na|em)\s+(?:[Ww]orkspace|[Qq]uadro)\s+([^\s,]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)*)/u)?.[1];
  if (workspaceName) inferred.workspaceName = workspaceName;
  const due = text.match(
    new RegExp(`\\b(?:para|pra|ate|até)\\s+((?:${DAY_WORDS}|dia\\s+\\d{1,2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)${TIME_OF_DAY})`, "iu"),
  )?.[1];
  if (due) inferred.dueAnswer = due.trim();
  const participants = text.match(
    /\bparticipantes?\s*:?\s+(.+?)(?=\s+(?:no|na|em)\s+(?:workspace|quadro)\b|\s+(?:para|pra|ate|até)\s|\s*[,;.]\s*(?:prioridade|urgente|respons)|[;.]|$)/iu,
  )?.[1];
  if (participants) inferred.participantNames = participants.trim();
  const priority = normalizeIntent(text).match(/\b(urgente|prioridade\s+(alta|media|baixa))\b/);
  if (priority) inferred.priorityName = priority[2] ?? priority[1];
  const responsible = text.match(/\b(?:atribui|atribua|atribuir|responsavel|responsável)\s+(?:a|ao|à|pra|para|pro|e|é)?\s*(?:o\s+|a\s+)?([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)*)/u)?.[1];
  if (responsible) inferred.responsibleName = responsible;
  return inferred;
}

// O modelo também preenche o título com o que achar na frase; prazo sozinho não é título.
const DEADLINE_ONLY_TITLE = new RegExp(
  `^(?:(?:para|pra|ate|até|as|às|a|de|dia|${DAY_WORDS}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|\\d{1,2}(?:\\s*(?:h(?:oras?)?\\s*\\d{0,2}|:\\d{2}))?)[\\s,.]*)+$`,
  "iu",
);

function splitNames(raw: string): string[] {
  return raw
    .split(/\s*(?:,|;|\be\b)\s*/iu)
    .map((name) => name.trim())
    .filter((name) => name.length >= 2);
}

const WORKSPACE_PICKER: AstroPicker = { kind: "entity", entity: "workspace", placeholder: "Buscar workspace" };

export const createWorkspaceActionItem: AstroAction<typeof inputSchema> = {
  key: "action.create",
  app: "workspaces",
  toolName: "create_workspace_task",
  description:
    "Cria uma DEMANDA/tarefa dentro de um workspace — 'adicione a demanda X', 'cria a tarefa X em Y', " +
    "'anota essa atividade'. É o cartão de trabalho, não o quadro inteiro.",
  permission: { appKey: "workspace", action: "create" },
  requiresConfirmation: false,
  newNameFields: ["title"],
  input: inputSchema,
  inferFields: inferTaskFields,
  codeOnlyFields: ["dueAnswer", "responsibleName", "priorityName", "participantNames", "descriptionAnswer"],
  intentPatterns: [
    /^(?!.*\b(checklist|check-list|subtarefas?|sub-tarefas?|subitem)\b).*\b(cria|criar|crie|adiciona|adicionar|adicione|nova|novo|abre|abrir|quero criar)\b.{0,20}\b(tarefa|demanda|atividade)\b/,
  ],
  fieldSteps: {
    // "O que precisa ser feito?" pedia o título com cara de descrição: a pessoa escrevia os
    // detalhes e eles viravam o nome da demanda. O título é pedido pelo nome; os detalhes têm passo próprio.
    title: {
      title: "Título da demanda",
      question: "Qual o título da demanda? Um nome curto, como \"Revisar contrato\".",
      picker: { kind: "text", placeholder: "Ex.: Revisar contrato", maxLength: 200 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (DEADLINE_ONLY_TITLE.test(input.title)) {
      return {
        status: "needs_input",
        title: "Título da demanda",
        description: "Qual o título da demanda? Um nome curto, como \"Revisar contrato\".",
        missingFields: [{ key: "title", label: "o título da demanda" }],
        appName: "Workspaces",
        picker: { kind: "text", placeholder: "Ex.: Revisar contrato", maxLength: 200 },
      };
    }

    const pickedWorkspace = input.workspaceName ? parsePickedAnswer(input.workspaceName) : null;
    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: ctx.organizationId,
        isArchived: false,
        ...(pickedWorkspace?.id
          ? { id: pickedWorkspace.id }
          : pickedWorkspace
            ? { name: { contains: pickedWorkspace.label, mode: "insensitive" } }
            : {}),
      },
      select: { id: true, name: true },
      take: 8,
    });

    if (workspaces.length === 0) {
      return {
        status: "needs_input",
        title: "Workspace não encontrado",
        description: input.workspaceName
          ? `Não achei workspace com "${pickedWorkspace?.label ?? input.workspaceName}". Busque abaixo.`
          : "Você ainda não tem workspace nenhum. Crie um antes.",
        missingFields: [{ key: "workspaceName", label: "o nome do workspace" }],
        appName: "Workspaces",
        picker: WORKSPACE_PICKER,
      };
    }

    if (workspaces.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual workspace?",
        description: "Em qual workspace eu crio a tarefa?",
        field: "workspaceName",
        options: workspaces.map((item) => ({ id: item.id, label: item.name })),
        appName: "Workspaces",
        picker: WORKSPACE_PICKER,
      };
    }
    const workspace = workspaces[0];

    // Prazo: pergunta, mas "sem prazo" é resposta válida.
    if (!input.dueAnswer) {
      return {
        status: "needs_input",
        title: "Prazo",
        description: "Para quando é a tarefa?",
        missingFields: [{ key: "dueAnswer", label: "o prazo" }],
        appName: "Workspaces",
        picker: {
          kind: "datetime",
          mode: "date",
          skipOption: { label: "Sem prazo", answer: NO_DEADLINE_ANSWER },
        },
      };
    }
    const isWithoutDeadline = normalizeIntent(input.dueAnswer) === NO_DEADLINE_ANSWER;
    const dueIso = isWithoutDeadline ? null : parseCalendarDate(input.dueAnswer);
    if (!isWithoutDeadline && !dueIso) {
      return {
        status: "needs_input",
        title: "Prazo",
        description: `Não entendi "${input.dueAnswer}" como data. Escolha o prazo.`,
        missingFields: [{ key: "dueAnswer", label: "o prazo" }],
        appName: "Workspaces",
        picker: {
          kind: "datetime",
          mode: "date",
          skipOption: { label: "Sem prazo", answer: NO_DEADLINE_ANSWER },
        },
      };
    }
    const dueDate = dueIso ? new Date(dueIso) : null;

    // Responsável: busca de membros, com "Eu mesmo" de atalho.
    if (!input.responsibleName) {
      return {
        status: "needs_input",
        title: "Responsável",
        description: "Quem fica responsável?",
        missingFields: [{ key: "responsibleName", label: "o responsável" }],
        appName: "Workspaces",
        picker: MEMBER_PICKER,
      };
    }
    const pickedResponsible = parsePickedAnswer(input.responsibleName);
    const responsible = await findTeamMember(ctx, input.responsibleName);
    if (!responsible) {
      return {
        status: "needs_input",
        title: "Responsável não encontrado",
        description: `Não achei "${pickedResponsible.label}" na equipe. Busque abaixo.`,
        missingFields: [{ key: "responsibleName", label: "o responsável" }],
        appName: "Workspaces",
        picker: MEMBER_PICKER,
      };
    }

    const priority = input.priorityName ? toPriority(input.priorityName) : null;
    if (!priority) {
      return {
        status: "needs_input",
        title: "Prioridade",
        description: "Qual a prioridade?",
        missingFields: [{ key: "priorityName", label: "a prioridade" }],
        appName: "Workspaces",
        picker: { kind: "select", options: PRIORITY_PICKER_OPTIONS },
      };
    }
    const priorityLabel = PRIORITY_OPTIONS.find((option) => option.answer === priority)!.label.toLowerCase();

    // Descrição: opcional, mas perguntada — é onde cabem os detalhes que não são título.
    if (input.descriptionAnswer === undefined) {
      return {
        status: "needs_input",
        title: "Descrição",
        description: "Quer descrever a demanda? Escreva os detalhes, ou siga sem descrição.",
        missingFields: [{ key: "descriptionAnswer", label: "a descrição" }],
        appName: "Workspaces",
        picker: {
          kind: "text",
          placeholder: "Detalhes do que precisa ser feito",
          maxLength: 4000,
          skipOption: { label: "Sem descrição", answer: NO_DESCRIPTION_ANSWER },
        },
      };
    }
    const hasDescription = normalizeIntent(input.descriptionAnswer).replace(/[.!]+$/, "") !== normalizeIntent(NO_DESCRIPTION_ANSWER);
    const description = hasDescription ? input.descriptionAnswer : null;

    const participants: { id: string; name: string }[] = [];
    const unknownParticipants: string[] = [];
    for (const spokenName of input.participantNames ? splitNames(input.participantNames) : []) {
      const member = await findTeamMember(ctx, spokenName);
      if (!member) unknownParticipants.push(spokenName);
      else if (!participants.some((participant) => participant.id === member.id)) participants.push(member);
    }

    const hasDueTime = hasTimeOfDay(input.dueAnswer);
    const summary =
      `"${input.title}" em ${workspace.name}, ${dueDate ? `prazo ${formatDay(dueDate, hasDueTime)}` : "sem prazo"}, ` +
      `responsável ${responsible.name}, prioridade ${priorityLabel}` +
      (participants.length > 0 ? `, participantes ${participants.map((participant) => participant.name).join(" e ")}` : "") +
      (description ? ", com descrição" : "") +
      "." +
      (unknownParticipants.length > 0 ? ` Não achei ${unknownParticipants.join(" e ")} na equipe — adicione pela demanda.` : "");

    if (dryRun) {
      return { status: "done", title: "Criar demanda", description: summary, appName: "Workspaces" };
    }

    // Primeira coluna do quadro é onde toda demanda nova nasce; sem coluna,
    // o cartão fica sem lugar e some da visão de board.
    const column = await prisma.workspaceColumn.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    const last = await prisma.action.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    // Imagem enviada pelo WhatsApp antes ou junto do pedido entra na demanda nova (spec 0080, RF-6).
    // Só o WhatsApp recebe imagem; nos outros canais nem consulta o armazenamento.
    const pendingImage =
      ctx.channel === "WHATSAPP"
        ? await takePendingTaskImage(ctx.sessionId, ctx.organizationId).catch((imageError: unknown) => {
            console.error("[astro/create-action] imagem pendente falhou", imageError);
            return null;
          })
        : null;
    const imageFields = pendingImage
      ? applyImageToTask({ image: pendingImage, currentAttachments: [], currentCoverImage: null })
      : null;

    const created = await prisma.action.create({
      data: {
        title: input.title,
        description,
        ...(imageFields ? { attachments: imageFields.attachments, coverImage: imageFields.coverImage } : {}),
        workspaceId: workspace.id,
        columnId: column?.id ?? null,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        dueDate,
        priority,
        order: last ? new Decimal(last.order).plus(1) : new Decimal(0),
        responsibles: { create: { userId: responsible.id } },
        participants: { create: participants.map((participant) => ({ userId: participant.id })) },
      },
      select: { id: true },
    });

    await notifyNewTask({
      actionId: created.id,
      title: input.title,
      workspaceId: workspace.id,
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      userIds: [responsible.id, ...participants.map((participant) => participant.id)],
    });

    return {
      status: "done",
      title: "Demanda criada",
      description: pendingImage ? `${summary} A imagem entrou como anexo e capa.` : summary,
      internalUrl: `/workspaces/${workspace.id}?action=${created.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};

