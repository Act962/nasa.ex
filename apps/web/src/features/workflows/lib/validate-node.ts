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

/**
 * Vários node components guardam config em `data.action.X` (LEAD_TAGGED, TAG,
 * MOVE_LEAD_STATUS, etc) e outros guardam direto em `data.X` (MOVE_LEAD,
 * SEND_*). Pra não precisar saber qual usa qual, achatamos: se houver
 * `data.action` objeto, usamos ele; senão usamos `data` direto.
 */
function unwrap(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const d = data ?? {};
  if (d.action && typeof d.action === "object" && !Array.isArray(d.action)) {
    return d.action as Record<string, unknown>;
  }
  return d;
}

/**
 * Verifica se um data tem ALGUMA chave significativa (não-vazia). Workflows
 * preexistentes criados via dialog sempre têm pelo menos uma chave — o user
 * passou pelo formulário que tem validação Zod própria (canSubmit). Se data
 * está populado, assumimos "já foi configurado pelo user" e não bloqueamos.
 *
 * Isso evita FALSOS POSITIVOS em produção — se eu validei errado um campo
 * (ex: `userId` quando dialog salva `responsibleId`), o workflow funcionando
 * em prod NÃO aparece como "Incompleto" só porque meu helper desalinhou.
 *
 * Trade-off aceito: meu tooltip detalhado ("Selecione a agenda") só dispara
 * pra nodes com data 100% vazio (recém-criados). Workflows configurados
 * ficam neutros mesmo que algum campo específico esteja faltando — mas o
 * dialog Zod já bloqueia salvar inválido, então isso é raro na prática.
 */
function hasAnyConfiguredField(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;
  for (const k of Object.keys(data)) {
    const v = (data as any)[k];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      // Aninhado (`action: {...}`) — recursão
      if (hasAnyConfiguredField(v as Record<string, unknown>)) return true;
      continue;
    }
    return true;
  }
  return false;
}

export function validateNode(
  type: string,
  data: Record<string, unknown> | null | undefined,
): NodeValidation {
  const d = unwrap(data);
  const errs: string[] = [];

  // ── Modo conservador (anti-falso-positivo em produção) ──────────────
  // Se o node tem QUALQUER campo populado, assume que foi configurado
  // via dialog (Zod do dialog já validou no submit). Helper não força
  // re-config — só mostra borda vermelha pra ações 100% vazias.
  //
  // Cobre workflows legados em prod que podem ter formatos de data
  // que meu switch case desconhece — não viram falso "Incompleto".
  if (hasAnyConfiguredField(data)) {
    return { valid: true, errors: [], skip: true };
  }

  switch (type) {
    // ── Estruturais — sem config, sempre válidos ────────────────────────
    case "INITIAL":
    case "MANUAL_TRIGGER":
    case "NEW_LEAD":
    case "FIRST_CHAT_INTERACTION":
    // FIRST_INTERACTION_OF_DAY tem default 08:00 — válido mesmo sem config.
    case "FIRST_INTERACTION_OF_DAY":
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

    case "SEND_MESSAGE": {
      // SEND_MESSAGE tem camada EXTRA: data.action.payload.X (executor lê
      // de data.action.payload.message/imageUrl/etc). Após unwrap pegamos
      // data.action; agora descemos pra `payload` se existir.
      const payload =
        d.payload && typeof d.payload === "object" && !Array.isArray(d.payload)
          ? (d.payload as Record<string, unknown>)
          : d;
      const t = payload.type;
      if (t === "IMAGE") {
        if (!hasNonEmptyString(payload.imageUrl))
          errs.push("Informe a URL da imagem");
      } else if (t === "DOCUMENT") {
        if (!hasNonEmptyString(payload.documentUrl))
          errs.push("Informe a URL do documento");
        if (!hasNonEmptyString(payload.fileName))
          errs.push("Informe o nome do arquivo");
      } else if (t === "BUTTONS") {
        // Modo preset → exige presetId. Modo inline → bodyText + 1+ buttons.
        const mode = payload.mode === "inline" ? "inline" : "preset";
        if (mode === "preset") {
          if (!hasNonEmptyString(payload.presetId))
            errs.push("Selecione um preset de botões");
        } else {
          if (!hasNonEmptyString(payload.bodyText))
            errs.push("Escreva o texto principal do menu");
          const buttons = Array.isArray(payload.buttons)
            ? payload.buttons
            : [];
          if (buttons.length === 0)
            errs.push("Adicione ao menos 1 botão");
          if (buttons.length > 9)
            errs.push("Máximo 9 botões");
        }
      } else {
        // Default = TEXT
        if (!hasNonEmptyString(payload.message))
          errs.push("Escreva a mensagem que será enviada");
      }
      break;
    }

    case "WAIT": {
      // Schema poligâmico por unit: minutes, hours, days, weeks. Cada um
      // exige seu próprio campo numérico (executor lê data.action.minutes
      // OR data.action.hours, etc).
      const unit = d.type ?? d.unit;
      const checkPositive = (v: unknown) => typeof v === "number" && v > 0;
      if (unit === "weeks") {
        if (!checkPositive(d.weeks)) errs.push("Defina o número de semanas");
      } else if (unit === "days") {
        if (!checkPositive(d.days)) errs.push("Defina o número de dias");
      } else if (unit === "hours") {
        if (!checkPositive(d.hours)) errs.push("Defina o número de horas");
      } else if (unit === "minutes") {
        if (!checkPositive(d.minutes))
          errs.push("Defina o número de minutos");
      } else {
        errs.push("Escolha a unidade de tempo (minutos/horas/dias/semanas)");
      }
      break;
    }

    case "WIN_LOSS":
      // Schema real: type ("WIN"|"LOSS") + reason (string obrigatório) +
      // observation (opcional). Executor lê data.action.reason.
      if (d.type !== "WIN" && d.type !== "LOSS")
        errs.push('Escolha "Won" ou "Lost"');
      if (!hasNonEmptyString(d.reason))
        errs.push("Selecione o motivo");
      break;

    case "RESPONSIBLE":
      // Executor lê data.action — schema do dialog tem `userId` ou
      // `responsibleId` (verificado em ambos).
      if (
        !hasNonEmptyString(d.userId) &&
        !hasNonEmptyString(d.responsibleId)
      )
        errs.push("Selecione um responsável");
      break;

    case "TEMPERATURE":
      // Executor: data.action.temperature.
      if (!hasNonEmptyString(d.temperature))
        errs.push("Escolha a temperatura");
      break;

    case "FILTER_LEAD":
      if (!hasNonEmptyArray(d.conditions))
        errs.push("Adicione ao menos 1 condição");
      break;

    case "HTTP_REQUEST":
      // Executor lê data.endpoint (não data.url) + data.method.
      // HTTP_REQUEST armazena FLAT, não em data.action — unwrap retorna data.
      if (!hasNonEmptyString(d.endpoint)) errs.push("Informe a URL (endpoint)");
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
      // Schema real: productIds[] + responsibleId + validityDays.
      if (!hasNonEmptyArray(d.productIds))
        errs.push("Selecione ao menos 1 produto");
      if (!hasNonEmptyString(d.responsibleId))
        errs.push("Selecione o responsável");
      if (typeof d.validityDays !== "number" || d.validityDays <= 0)
        errs.push("Defina a validade em dias");
      break;

    case "SEND_CONTRACT":
      // Campo correto = templateContractId (não contractTemplateId).
      if (!hasNonEmptyString(d.templateContractId))
        errs.push("Selecione o modelo de contrato");
      break;

    case "SEND_LINNKER":
      // Campo correto = linnkerPageId (não linnkerId).
      if (!hasNonEmptyString(d.linnkerPageId))
        errs.push("Selecione a página Linnker");
      break;

    case "SEND_NBOX":
      // Campo correto = nboxItemId (não nboxId).
      if (!hasNonEmptyString(d.nboxItemId))
        errs.push("Selecione o item do N-Box");
      break;

    case "SEND_NASA_ROUTE":
      if (!hasNonEmptyString(d.courseId))
        errs.push("Selecione o curso NASA Route");
      break;

    // ─── Modo Agente IA (N8n-style) ─────────────────────────────────────
    // Os cases abaixo são minimalistas — config detalhada vive no Inspector
    // visual. Aqui só vetamos os campos sem os quais o engine não roda.

    case "IF_CONDITION":
      // data: { conditions: [{ field, operator, value }], combinator: "AND"|"OR" }
      if (!hasNonEmptyArray(d.conditions))
        errs.push("Adicione ao menos 1 condição");
      break;

    case "SWITCH_CASE":
      // data: { field: "lead.tag", cases: [{ value, output }] }
      if (!hasNonEmptyString(d.field))
        errs.push("Informe o campo a avaliar");
      if (!hasNonEmptyArray(d.cases))
        errs.push("Adicione ao menos 1 caso");
      break;

    case "LOOP_OVER":
      // data: { arrayPath: "lead.tags", maxIterations: 4 }
      if (!hasNonEmptyString(d.arrayPath))
        errs.push("Informe o caminho do array a iterar");
      if (typeof d.maxIterations !== "number" || d.maxIterations <= 0)
        errs.push("Defina um limite máximo de iterações");
      break;

    case "MERGE":
      // Sem config — só consolida inputs. Validade depende do grafo (>=2 inputs).
      return { valid: true, errors: [], skip: true };

    case "WAIT_FOR_EVENT":
      // data: { eventName: "payment.received", timeoutMinutes: 1440 }
      if (!hasNonEmptyString(d.eventName))
        errs.push("Informe o evento a aguardar");
      if (typeof d.timeoutMinutes !== "number" || d.timeoutMinutes <= 0)
        errs.push("Defina um timeout em minutos");
      break;

    case "AI_DECISION":
      // data: { prompt, branches: [{ id, label, description }] }
      if (!hasNonEmptyString(d.prompt))
        errs.push("Descreva o que a IA deve decidir");
      if (!hasNonEmptyArray(d.branches))
        errs.push("Defina ao menos 2 ramos de decisão");
      else if ((d.branches as unknown[]).length < 2)
        errs.push("Defina ao menos 2 ramos de decisão");
      break;

    case "AI_GENERATE_TEXT":
      // data: { prompt, tone?, maxTokens? }
      if (!hasNonEmptyString(d.prompt))
        errs.push("Descreva o que a IA deve gerar");
      break;

    case "AI_VISION":
      // data: { imagePath, instruction }
      if (!hasNonEmptyString(d.imagePath))
        errs.push("Informe o caminho da imagem no contexto");
      if (!hasNonEmptyString(d.instruction))
        errs.push("Descreva o que extrair da imagem");
      break;

    case "READ_PDF":
      // data: { pdfPath, instruction? }
      if (!hasNonEmptyString(d.pdfPath))
        errs.push("Informe o caminho do PDF no contexto");
      break;

    case "SET_VARIABLE":
      // data: { name, value | expression }
      if (!hasNonEmptyString(d.name))
        errs.push("Informe o nome da variável");
      if (
        !hasNonEmptyString(d.value) &&
        !hasNonEmptyString(d.expression)
      )
        errs.push("Informe um valor ou expressão");
      break;

    case "CALL_WORKFLOW":
      // data: { workflowId }
      if (!hasNonEmptyString(d.workflowId))
        errs.push("Selecione o sub-workflow");
      break;

    case "CHECK_PAYMENT":
      // data: { provider: "STRIPE"|"ASAAS", paymentId | leadId }
      if (d.provider !== "STRIPE" && d.provider !== "ASAAS")
        errs.push('Escolha "Stripe" ou "Asaas"');
      if (!hasNonEmptyString(d.paymentId) && !hasNonEmptyString(d.leadId))
        errs.push("Informe ID do pagamento ou do lead");
      break;

    case "SEND_VOICE":
      // data: { text | textPath, voice? }
      if (!hasNonEmptyString(d.text) && !hasNonEmptyString(d.textPath))
        errs.push("Informe o texto a ser falado");
      break;

    case "SEND_MEDIA":
      // data: { mediaType: "IMAGE"|"VIDEO"|"AUDIO"|"DOCUMENT", url, caption? }
      if (
        d.mediaType !== "IMAGE" &&
        d.mediaType !== "VIDEO" &&
        d.mediaType !== "AUDIO" &&
        d.mediaType !== "DOCUMENT"
      )
        errs.push("Escolha o tipo de mídia");
      if (!hasNonEmptyString(d.url))
        errs.push("Informe a URL da mídia");
      break;

    case "WEB_SEARCH":
      // data: { query: string, preferredProvider?: "gemini"|"openai", organizationId? }
      if (!hasNonEmptyString(d.query))
        errs.push("Informe o que pesquisar (suporta {{vars.x}})");
      break;

    // Triggers novos — config mínima
    case "PAYMENT_RECEIVED":
      // data: { provider?: "STRIPE"|"ASAAS"|"ANY", minAmountCents? }
      // Tudo opcional — sem config = aceita qualquer pagamento.
      return { valid: true, errors: [], skip: true };

    case "MESSAGE_INCOMING":
      // data: { containsAny?: string[], regex? }
      return { valid: true, errors: [], skip: true };

    case "WEBHOOK_EXTERNAL":
      // data: { secret? } — secret recomendado, mas não obrigatório
      return { valid: true, errors: [], skip: true };

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
    "FIRST_INTERACTION_OF_DAY",
    "LAST_INBOUND_TIMEOUT",
    // Triggers do Modo Agente IA
    "PAYMENT_RECEIVED",
    "MESSAGE_INCOMING",
    "WEBHOOK_EXTERNAL",
  ].includes(type);
}

/**
 * Categoriza nodes pra paleta do Modo Agente IA (UI). Estrutura espelha
 * os AccordionItems do node-selector: Gatilhos | Lógica | IA | Comunicação |
 * Pagamento | NASA Apps | Outros.
 */
export type NodeCategory =
  | "trigger"
  | "logic"
  | "ai"
  | "communication"
  | "payment"
  | "nasa-app"
  | "data"
  | "action";

export function getNodeCategory(type: string): NodeCategory {
  if (isTriggerNode(type)) return "trigger";

  switch (type) {
    case "IF_CONDITION":
    case "SWITCH_CASE":
    case "LOOP_OVER":
    case "MERGE":
    case "WAIT_FOR_EVENT":
    case "FILTER_LEAD":
    case "WAIT":
      return "logic";

    case "AI_DECISION":
    case "AI_GENERATE_TEXT":
    case "AI_VISION":
    case "READ_PDF":
      return "ai";

    case "SEND_MESSAGE":
    case "SEND_VOICE":
    case "SEND_MEDIA":
      return "communication";

    case "CHECK_PAYMENT":
      return "payment";

    case "SEND_FORM":
    case "OPEN_FORM":
    case "SEND_AGENDA":
    case "SEND_PROPOSAL":
    case "SEND_CONTRACT":
    case "SEND_LINNKER":
    case "SEND_NBOX":
    case "SEND_NASA_ROUTE":
      return "nasa-app";

    case "SET_VARIABLE":
    case "CALL_WORKFLOW":
    case "HTTP_REQUEST":
      return "data";

    default:
      return "action";
  }
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
