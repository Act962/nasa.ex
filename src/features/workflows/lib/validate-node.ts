/**
 * Validação por NodeType — espelha os Zod schemas dos dialogs de cada
 * action/app. Usada pra:
 *  - Pintar borda vermelha/verde no node do canvas
 *  - Desabilitar o toggle "Ativo" do workflow se algum action está inválido
 *  - Mostrar tooltip detalhado com o motivo da quebra
 *
 * Triggers (LEAD_TAGGED, NEW_LEAD, etc) também são validados, mas a
 * categorização (trigger vs action) fica no helper `categorizeNode` —
 * o toggle "Ativo" considera AMBOS, pq trigger sem config também não dispara.
 */

export type NodeValidation = {
  valid: boolean;
  /** Mensagens curtas que aparecem no tooltip do node + alerta do workflow. */
  errors: string[];
  /** Triggers iniciais (INITIAL/MANUAL) são "skipped" — não inválidos, só não bloqueiam. */
  skip?: boolean;
};

function hasNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasNonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

export function validateNode(
  type: string,
  data: Record<string, unknown> | null | undefined,
): NodeValidation {
  const d = data ?? {};
  const errs: string[] = [];

  switch (type) {
    // ── Estruturais — sem config, sempre válidos ────────────────────────
    case "INITIAL":
    case "MANUAL_TRIGGER":
    case "NEW_LEAD":
    case "FIRST_CHAT_INTERACTION":
    case "AI_FINISHED":
      return { valid: true, errors: [], skip: true };

    // ── Triggers que dependem de seleção ────────────────────────────────
    case "LEAD_TAGGED":
      if (!hasNonEmptyArray(d.tagIds)) errs.push("Selecione ao menos 1 tag");
      break;

    case "MOVE_LEAD_STATUS":
      if (!hasNonEmptyString(d.statusId)) errs.push("Selecione um status");
      break;

    case "LAST_INBOUND_TIMEOUT":
      if (typeof d.minutes !== "number" || d.minutes <= 0)
        errs.push("Defina o tempo em minutos");
      break;

    // ── Actions ─────────────────────────────────────────────────────────
    case "TAG":
      if (!hasNonEmptyArray(d.tagsIds))
        errs.push("Selecione ao menos 1 tag");
      if (d.type !== "ADD" && d.type !== "REMOVE")
        errs.push('Escolha "Adicionar" ou "Remover"');
      break;

    case "MOVE_LEAD":
      if (!hasNonEmptyString(d.trackingId))
        errs.push("Selecione o tracking de destino");
      if (!hasNonEmptyString(d.statusId))
        errs.push("Selecione um status");
      break;

    case "SEND_MESSAGE":
      if (!hasNonEmptyString(d.message))
        errs.push("Escreva a mensagem que será enviada");
      break;

    case "WAIT":
      if (typeof d.duration !== "number" || d.duration <= 0)
        errs.push("Defina a duração");
      break;

    case "WIN_LOSS":
      if (d.type !== "WIN" && d.type !== "LOSS")
        errs.push('Escolha "Won" ou "Lost"');
      break;

    case "RESPONSIBLE":
      if (!hasNonEmptyString(d.userId))
        errs.push("Selecione um responsável");
      break;

    case "TEMPERATURE":
      if (!hasNonEmptyString(d.temperature))
        errs.push("Escolha a temperatura");
      break;

    case "FILTER_LEAD":
      if (!hasNonEmptyArray(d.conditions))
        errs.push("Adicione ao menos 1 condição");
      break;

    case "HTTP_REQUEST":
      if (!hasNonEmptyString(d.url)) errs.push("Informe a URL");
      if (!hasNonEmptyString(d.method)) errs.push("Escolha o método HTTP");
      break;

    // ── Send to App — cada app tem ID próprio ──────────────────────────
    case "SEND_FORM":
    case "OPEN_FORM":
      if (!hasNonEmptyString(d.formId))
        errs.push("Selecione o formulário");
      break;

    case "SEND_AGENDA":
      if (!hasNonEmptyString(d.agendaId))
        errs.push("Selecione a agenda");
      break;

    case "SEND_PROPOSAL":
      if (
        !hasNonEmptyString(d.proposalTemplateId) &&
        !hasNonEmptyString(d.proposalId)
      )
        errs.push("Selecione o modelo de proposta");
      break;

    case "SEND_CONTRACT":
      if (
        !hasNonEmptyString(d.contractTemplateId) &&
        !hasNonEmptyString(d.contractId)
      )
        errs.push("Selecione o modelo de contrato");
      break;

    case "SEND_LINNKER":
      if (!hasNonEmptyString(d.linnkerId))
        errs.push("Selecione o link Linnker");
      break;

    case "SEND_NBOX":
      if (!hasNonEmptyString(d.nboxId)) errs.push("Selecione o N-Box");
      break;

    case "SEND_NASA_ROUTE":
      if (!hasNonEmptyString(d.courseId))
        errs.push("Selecione o curso NASA Route");
      break;

    // ── Desconhecido — assume válido pra não bloquear sem motivo ────────
    default:
      return { valid: true, errors: [], skip: true };
  }

  return { valid: errs.length === 0, errors: errs };
}

/**
 * Categoriza um node — usado pra distinguir triggers (entrada) de actions
 * (passos do fluxo). Apenas convenção pra UI; comportamento de validação
 * é o mesmo nos dois.
 */
export function isTriggerNode(type: string): boolean {
  return [
    "INITIAL",
    "MANUAL_TRIGGER",
    "NEW_LEAD",
    "MOVE_LEAD_STATUS",
    "LEAD_TAGGED",
    "AI_FINISHED",
    "FIRST_CHAT_INTERACTION",
    "LAST_INBOUND_TIMEOUT",
  ].includes(type);
}

/**
 * Valida um workflow inteiro: roda `validateNode` em todos os nodes e
 * agrega resultados. Retorna `{ valid, blockingNodes }` onde
 * `blockingNodes` é uma lista de IDs com erros (ignorando nodes `skip`).
 */
export function validateWorkflow(
  nodes: Array<{ id: string; type: string; data: unknown; name?: string | null }>,
): {
  valid: boolean;
  blockingNodes: Array<{
    id: string;
    type: string;
    name: string;
    errors: string[];
  }>;
} {
  const blocking: Array<{
    id: string;
    type: string;
    name: string;
    errors: string[];
  }> = [];

  for (const node of nodes) {
    const v = validateNode(
      node.type,
      node.data as Record<string, unknown> | null,
    );
    if (v.skip) continue;
    if (!v.valid) {
      blocking.push({
        id: node.id,
        type: node.type,
        name: node.name ?? node.type,
        errors: v.errors,
      });
    }
  }

  return { valid: blocking.length === 0, blockingNodes: blocking };
}
