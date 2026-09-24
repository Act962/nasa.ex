import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "./registry";
import { proposeAction } from "./confirmation";
import { appearsIn, buildActionInput } from "./coerce-fields";
import { checkAstroPermission } from "./permission-gate";
import type { AstroConfirmationPayload } from "@/features/astro/lib/astro-confirmation";
import type { AstroAction, AstroActionResult } from "./types";
import {
  HIGH_CONFIDENCE,
  LOW_CONFIDENCE,
  type StagedClassification,
} from "./classify-staged";

/**
 * Decide o que a ação classificada produz — permissão, campos que faltam,
 * escolha, confirmação ou execução. Só a DECISÃO mora aqui.
 *
 * Existe separado do runner porque o Astro tem duas bocas: o chat, que
 * responde em stream com cartões, e o WhatsApp, que responde em texto. Antes,
 * toda esta inteligência estava presa ao formato do chat, e pelo WhatsApp o
 * usuário caía direto no orquestrador — caro e sem os verbos novos.
 */

export type ClassifiedOutput = AstroActionResult | AstroConfirmationPayload;

export type ResolvedClassification =
  | { kind: "choice"; payload: AstroActionResult; actionKey: string }
  | {
      kind: "result";
      action: AstroAction;
      output: ClassifiedOutput;
      denied?: boolean;
      /** O que já foi coletado — o próximo turno soma a isto. */
      pendingFields?: Record<string, unknown>;
      /** Campo que a pergunta atual espera. */
      awaitingField?: string;
      /** Opções mostradas, para "2" virar a segunda delas. */
      awaitingOptions?: { id: string; label: string }[];
    };

export function isConfirmation(
  value: ClassifiedOutput,
): value is AstroConfirmationPayload {
  return "kind" in value && value.kind === "astro_confirmation";
}

function missingRequiredFields(
  action: AstroAction,
  fields: Record<string, unknown>,
): string[] {
  const parsed = action.input.safeParse(fields);
  if (parsed.success) return [];
  // `invalid_value` entra na lista: sem ele, um enum recusado devolvia lista
  // vazia e o Astro perguntava "me diga: ." — pergunta sem pergunta.
  return parsed.error.issues
    .filter(
      (issue) =>
        issue.code === "invalid_type" ||
        issue.code === "too_small" ||
        issue.code === "invalid_value" ||
        issue.code === "invalid_format",
    )
    .map((issue) => String(issue.path[0] ?? ""))
    .filter(Boolean);
}

/** Rótulo falado do campo. Sem isso o Astro pediria "clientName" em voz alta. */
const FIELD_LABELS: Record<string, string> = {
  clientName: "o nome do cliente",
  productName: "o produto",
  title: "o título",
  validUntil: "a validade",
  leadName: "o nome do lead",
  personName: "o nome da pessoa",
  formName: "o nome do formulário",
  trackingName: "o nome do tracking",
  workspaceName: "o nome do workspace",
  tagName: "o nome da tag",
  scope: "se a tag é para tracking (leads) ou workspace (tarefas)",
  agendaName: "o nome da agenda",
  accountName: "o nome da conta",
  amount: "o valor",
  description: "a descrição do lançamento",
  type: "se é despesa ou receita",
  dueDate: "o vencimento",
  statusName: "o nome da coluna",
  currentName: "o nome atual da coluna",
  newName: "o novo nome",
  startsAt: "o novo horário",
  remindTime: "o horário",
  recurrence: "a frequência",
  message: "a mensagem",
  note: "o que anotar",
  date: "o dia",
  phone: "o telefone",
  templateName: "o nome do template",
  published: "se é para publicar ou tirar do ar",
  favorite: "se é para favoritar ou desfavoritar",
  active: "se é para ativar ou desativar",
  blocked: "se é para bloquear ou liberar",
};

export function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Primeira frase da descrição, que é o rótulo humano da ação. */
function shortLabel(description: string): string {
  const [first] = description.split(" — ");
  return first.split(". ")[0];
}

/**
 * Opções para o campo que faltou. Perguntar "me diga: o nome do tracking"
 * obriga o usuário a lembrar e digitar o que o sistema já sabe — quando a
 * lista é curta, a escolha responde em um toque.
 */
async function optionsForField(
  ctx: AgentContext,
  field: string,
): Promise<{ id: string; label: string }[] | null> {
  const MAX_OPTIONS = 8;
  const where = { organizationId: ctx.organizationId };

  if (field === "trackingName") {
    const rows = await prisma.tracking.findMany({
      where,
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  if (field === "agendaName") {
    const rows = await prisma.agenda.findMany({
      where,
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  if (field === "formName") {
    const rows = await prisma.form.findMany({
      where,
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  if (field === "workspaceName") {
    const rows = await prisma.workspace.findMany({
      where: { ...where, isArchived: false },
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  return null;
}

/**
 * O sujeito que o turno anterior nomeou.
 *
 * "Mover para a coluna Em andamento", logo após "encontrei o lead João de
 * Souza", fala do João — mas a frase não o nomeia, e a regra de citação da
 * spec 0024 (com razão) recusa nome que não está na frase.
 *
 * A herança acontece em código, e só quando o nome existe nos DOIS lugares:
 * na conversa e no banco. Assim o Astro não inventa um sujeito — reconhece um
 * que já disse. Ensinar isso ao classificador pelo prompt foi tentado e
 * medido: derrubou "assunto novo não herda" de 3/3 para 0/3.
 */
async function subjectFromHistory(params: {
  ctx: AgentContext;
  field: string;
  history?: string[];
}): Promise<string | null> {
  if (params.field !== "leadName") return null;
  const history = (params.history ?? []).slice(-4).join(" ");
  if (!history) return null;

  const leads = await prisma.lead.findMany({
    where: { tracking: { organizationId: params.ctx.organizationId } },
    select: { name: true },
    take: 200,
  });
  const mentioned = leads.filter(
    (lead) => lead.name.trim().length >= 3 && appearsIn(lead.name, history),
  );
  const unique = [...new Set(mentioned.map((lead) => lead.name))];
  return unique.length === 1 ? unique[0] : null;
}

function buildChoicePayload(
  classification: StagedClassification,
  userText: string,
): AstroActionResult {
  const options = classification.candidates
    .map((candidate) => {
      const action = getAstroAction(candidate.action);
      if (!action) return null;
      return {
        id: candidate.action,
        label: action.confirmTitle ?? shortLabel(action.description),
      };
    })
    .filter((option): option is { id: string; label: string } => option !== null);

  return {
    status: "ambiguous",
    title: "O que você quer fazer?",
    description: `Entendi "${userText}" de mais de um jeito. Qual deles?`,
    field: "action",
    options,
    appName: classification.app,
  };
}

/**
 * `null` significa "não consigo resolver por aqui" — quem chama segue para o
 * orquestrador, que é o comportamento de sempre.
 */
export async function resolveClassifiedAction(params: {
  ctx: AgentContext;
  classification: StagedClassification;
  /** Frase original — `inferFields` lê dela a polaridade do verbo. */
  userText?: string;
  /** Turnos anteriores — só eles autorizam um nome que a frase não disse. */
  history?: string[];
}): Promise<ResolvedClassification | null> {
  const [best, ...rest] = params.classification.candidates;
  if (!best) return null;

  // Dúvida vira escolha, não chute nem modelo mais caro (spec 0025, D-2).
  //
  // Candidato único e incerto não é certeza: "põe o João no tracking de
  // vendas" voltou uma vez só com `tracking.create` a 0,6, e teria criado um
  // funil chamado Vendas. Sem alternativa para oferecer, o orquestrador
  // atende — custa ★, não custa um registro errado no banco.
  if (best.confidence < HIGH_CONFIDENCE) {
    if (rest.length === 0 || best.confidence < LOW_CONFIDENCE) return null;
    return {
      kind: "choice",
      payload: buildChoicePayload(params.classification, params.userText ?? ""),
      actionKey: best.action,
    };
  }

  const action = getAstroAction(best.action);
  if (!action) return null;

  return resolveActionWithFields({
    ctx: params.ctx,
    action,
    rawFields: best.fields,
    userText: params.userText,
    history: params.history,
  });
}

/**
 * Resolve uma ação com os campos já em mãos — sem classificar de novo.
 *
 * É o que sustenta o ciclo guiado: o usuário responde "2", depois "despesa",
 * depois "100,00", e cada resposta soma à anterior. Antes, cada turno voltava
 * ao classificador e perdia o que já tinha sido dito — o lançamento perguntava
 * o valor duas vezes e nunca saía.
 */
export async function resolveActionWithFields(params: {
  ctx: AgentContext;
  action: AstroAction;
  /** Campos crus (strings do classificador ou respostas do usuário). */
  rawFields: Record<string, string>;
  userText?: string;
  history?: string[];
}): Promise<ResolvedClassification | null> {
  const { action } = params;
  const rawFields = buildActionInput(
    action,
    params.rawFields,
    params.userText ?? "",
    params.history,
  );

  // Campo que aponta para algo existente pode vir do turno anterior.
  let fields = rawFields;
  let missing = missingRequiredFields(action, fields);
  const inheritable = missing.find(
    (field) => !(action.newNameFields ?? []).includes(field),
  );
  if (inheritable) {
    const inherited = await subjectFromHistory({
      ctx: params.ctx,
      field: inheritable,
      history: params.history,
    });
    if (inherited) {
      fields = { ...fields, [inheritable]: inherited };
      missing = missingRequiredFields(action, fields);
    }
  }
  const parsed = action.input.safeParse(fields);

  // Permissão antes de qualquer coisa: antes do ensaio, antes da confirmação,
  // antes até de perguntar o que falta — perguntar o nome do lead para depois
  // recusar a exclusão é desperdiçar o tempo de quem não podia mesmo.
  const allowed = await checkAstroPermission({
    ctx: params.ctx,
    appKey: action.permission.appKey,
    action: action.permission.action,
  });
  if (!allowed.ok) {
    return {
      kind: "result",
      action,
      denied: true,
      output: {
        status: "error",
        title: "Sem permissão",
        description: allowed.error,
        appName: action.app,
      },
    };
  }

  // Campo que nomeia algo já cadastrado vira escolha, não pergunta aberta.
  const askable = missing[0];
  const namesSomethingNew = askable
    ? (action.newNameFields ?? []).includes(askable)
    : false;
  const choices =
    askable && !namesSomethingNew
      ? await optionsForField(params.ctx, askable)
      : null;

  const output: ClassifiedOutput =
    missing.length > 0 || !parsed.success
      ? choices && missing.length === 1
        ? {
            status: "ambiguous",
            title: "Qual deles?",
            description: `Escolha ${labelFor(askable!)} para eu continuar.`,
            field: askable!,
            options: choices,
            appName: "Órbita",
          }
        : {
            status: "needs_input",
            title: "Falta uma informação",
            description: `Para continuar, me diga: ${missing.map(labelFor).join(", ")}.`,
            missingFields: missing.map((field) => ({ key: field, label: labelFor(field) })),
            appName: "Órbita",
          }
      : action.requiresConfirmation
        ? await proposeAction({
            ctx: params.ctx,
            action,
            input: parsed.data as Record<string, unknown>,
            warnings: action.confirmWarnings,
          })
        : await action.execute({ ctx: params.ctx, input: parsed.data });

  // O campo esperado sai do PRÓPRIO resultado, não de `missing`: "Em qual
  // conta?" nasce dentro do `execute`, quando a resolução por nome encontra
  // mais de um registro, e aí `missing` está vazio. Ler só `missing` fazia a
  // resposta cair no vazio e a pergunta se repetir para sempre.
  const awaiting = (() => {
    if ("kind" in output) return undefined;
    if (output.status === "ambiguous") return output.field;
    if (output.status === "needs_input") return output.missingFields[0]?.key;
    return undefined;
  })();

  return {
    kind: "result",
    action,
    output,
    // Quem chama guarda isto para somar a próxima resposta em vez de
    // recomeçar: é o estado do ciclo guiado.
    pendingFields: fields as Record<string, unknown>,
    awaitingField: awaiting ?? askable,
    awaitingOptions:
      !("kind" in output) && output.status === "ambiguous" ? output.options : undefined,
  };
}
