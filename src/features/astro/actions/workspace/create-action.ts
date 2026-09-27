import "server-only";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parseCalendarDate } from "../parse-when";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

// Criar demanda/tarefa dentro de um workspace. Sem este verbo, "adicione a
// demanda CRIAR SITE dentro de DEMANDAS" caía em `workspace.create` e
// respondia que o workspace já existia — o buraco de verbo ausente de novo.
// Roteiro (spec 0033, RF-9): título → workspace → prazo → responsável →
// prioridade, cada passo com o seu seletor.

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const NO_DEADLINE_ANSWER = "sem prazo";
const MYSELF_ANSWER = "eu mesmo";

const PRIORITY_OPTIONS = [
  { label: "Sem prioridade", answer: "NONE" },
  { label: "Baixa", answer: "LOW" },
  { label: "Média", answer: "MEDIUM" },
  { label: "Alta", answer: "HIGH" },
  { label: "Urgente", answer: "URGENT" },
] as const;

type ActionPriority = (typeof PRIORITY_OPTIONS)[number]["answer"];

const PRIORITY_WORDS: Record<string, ActionPriority> = {
  urgente: "URGENT",
  alta: "HIGH",
  media: "MEDIUM",
  baixa: "LOW",
  nenhuma: "NONE",
  sem: "NONE",
};

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
});

function normalizeIntent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toPriority(raw: string): ActionPriority | null {
  const normalized = normalizeIntent(raw.trim());
  const byAnswer = PRIORITY_OPTIONS.find((option) => option.answer.toLowerCase() === normalized);
  if (byAnswer) return byAnswer.answer;
  const word = Object.keys(PRIORITY_WORDS).find((key) => new RegExp(`\\b${key}\\b`).test(normalized));
  return word ? PRIORITY_WORDS[word] : null;
}

const DAY_WORDS = "amanha|amanhã|hoje|depois de amanha|depois de amanhã|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo";

/** "cria a tarefa revisar contrato no workspace Operação para amanhã, urgente" → campos, sem modelo. */
function inferTaskFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const title = text.match(
    new RegExp(
      `\\b(?:tarefa|demanda|atividade)\\s+(?:de\\s+|para\\s+)?["“]?(.+?)["”]?(?=\\s+(?:no|na|em)\\s+(?:workspace|quadro)\\b|\\s+(?:para|pra|ate|até)\\s+(?:${DAY_WORDS}|dia\\s+\\d|\\d{1,2}\\/\\d{1,2})|,|$)`,
      "iu",
    ),
  )?.[1];
  if (title && title.trim().length >= 2) inferred.title = title.trim();
  // Sem a flag "i": a continuação do nome exige inicial maiúscula, senão
  // "Operação para amanhã" virava o nome do workspace.
  const workspaceName = text.match(/\b(?:no|na|em)\s+(?:[Ww]orkspace|[Qq]uadro)\s+([^\s,]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)*)/u)?.[1];
  if (workspaceName) inferred.workspaceName = workspaceName;
  const due = text.match(
    new RegExp(`\\b(?:para|pra|ate|até)\\s+(${DAY_WORDS}|dia\\s+\\d{1,2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)`, "iu"),
  )?.[1];
  if (due) inferred.dueAnswer = due;
  const priority = normalizeIntent(text).match(/\b(urgente|prioridade\s+(alta|media|baixa))\b/);
  if (priority) inferred.priorityName = priority[2] ?? priority[1];
  const responsible = text.match(/\b(?:atribui|atribua|atribuir|responsavel|responsável)\s+(?:a|ao|à|pra|para|pro|e|é)?\s*(?:o\s+|a\s+)?([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)*)/u)?.[1];
  if (responsible) inferred.responsibleName = responsible;
  return inferred;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
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
  codeOnlyFields: ["dueAnswer", "responsibleName", "priorityName"],
  intentPatterns: [
    /\b(cria|criar|crie|adiciona|adicionar|adicione|nova|novo|abre|abrir|quero criar)\b.{0,20}\b(tarefa|demanda|atividade)\b/,
  ],
  fieldSteps: {
    title: {
      title: "Qual a tarefa?",
      question: "O que precisa ser feito?",
      picker: { kind: "text", placeholder: "Ex.: Revisar contrato", maxLength: 200 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
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
        picker: {
          kind: "entity",
          entity: "member",
          placeholder: "Buscar pessoa da equipe",
          noneOption: { label: "Eu mesmo", answer: MYSELF_ANSWER },
        },
      };
    }
    const pickedResponsible = parsePickedAnswer(input.responsibleName);
    const responsible =
      normalizeIntent(pickedResponsible.label) === MYSELF_ANSWER
        ? await prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, name: true } })
        : await prisma.user.findFirst({
            where: {
              members: { some: { organizationId: ctx.organizationId } },
              ...(pickedResponsible.id
                ? { id: pickedResponsible.id }
                : { name: { contains: pickedResponsible.label, mode: "insensitive" } }),
            },
            select: { id: true, name: true },
          });
    if (!responsible) {
      return {
        status: "needs_input",
        title: "Responsável não encontrado",
        description: `Não achei "${pickedResponsible.label}" na equipe. Busque abaixo.`,
        missingFields: [{ key: "responsibleName", label: "o responsável" }],
        appName: "Workspaces",
        picker: {
          kind: "entity",
          entity: "member",
          placeholder: "Buscar pessoa da equipe",
          noneOption: { label: "Eu mesmo", answer: MYSELF_ANSWER },
        },
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
        picker: { kind: "select", options: PRIORITY_OPTIONS.map((option) => ({ ...option })) },
      };
    }
    const priorityLabel = PRIORITY_OPTIONS.find((option) => option.answer === priority)!.label.toLowerCase();
    const summary =
      `"${input.title}" em ${workspace.name}, ${dueDate ? `prazo ${formatDay(dueDate)}` : "sem prazo"}, ` +
      `responsável ${responsible.name}, prioridade ${priorityLabel}.`;

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

    const created = await prisma.action.create({
      data: {
        title: input.title,
        workspaceId: workspace.id,
        columnId: column?.id ?? null,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        dueDate,
        priority,
        order: last ? new Decimal(last.order).plus(1) : new Decimal(0),
        responsibles: { create: { userId: responsible.id } },
      },
      select: { id: true },
    });

    return {
      status: "done",
      title: "Demanda criada",
      description: summary,
      internalUrl: `/workspaces/${workspace.id}?action=${created.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};

