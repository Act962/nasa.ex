/**
 * Fallback "best-effort" pros executors de IA quando o provider LLM
 * (OpenAI/Anthropic/Google) falha por motivos não-recuperáveis pela
 * automação (quota esgotada, key inválida, server 5xx).
 *
 * Estratégia: heurística contextual determinística, ZERO dependência
 * externa, roda no mesmo Node runtime dos executors. Não tenta ser
 * "inteligente" — tenta ser CORRETA pra os casos mais comuns:
 *
 *   1. Menu de botões — lead clica/digita o texto do botão → match direto
 *   2. Resposta curta com keyword reconhecível → match parcial
 *   3. Tag do lead alinhada com branch → bias contextual
 *   4. Default — primeira branch (definida como "safe default" pelo dev)
 *
 * Trade-off vs LLM real:
 *   - Decision baseada em prompt complexo do dev → fallback é burro,
 *     escolhe default. Quem se beneficia de LLM real perde aqui.
 *   - Decision baseada em menu/keyword → fallback acerta 95%+ dos casos.
 *
 * Pra AI_GENERATE_TEXT/AI_VISION/READ_PDF, fallback é template fixo —
 * permite o workflow continuar mas com mensagem genérica.
 *
 * Todo output do fallback carrega `usedFallback: true` pra debug.
 */

export type FallbackMethod =
  | "exact-match"
  | "keyword-match"
  | "tag-bias"
  | "default"
  | "template"
  /** Evento "soft" do app (proposal-accepted/contract-signed/etc) bate
   *  diretamente com a branch — confiança 1.0 sem precisar de LLM nem texto. */
  | "event-match";

/**
 * Mapeamento de eventos "soft" pro id da branch que devem disparar.
 * Funciona em conjunto com o `WAIT_FOR_EVENT` que escuta múltiplos eventos —
 * quando o engine acorda via `proposal-accepted`, o fallback escolhe a branch
 * "aceitou" SEM precisar interpretar texto. LLM real respeita a mesma
 * convenção via prompt (vide preset `proposta-contrato`).
 *
 * Override por workflow possível: o nó `AI_DECISION.data.eventBranchMap` pode
 * trazer mapeamentos customizados que substituem esses defaults.
 */
const DEFAULT_EVENT_BRANCH_MAP: Record<string, string> = {
  "proposal-accepted": "aceitou",
  "proposal-rejected": "rejeitou",
  "contract-signed": "aceitou",
};

export interface FallbackDecisionInput {
  branches: Array<{
    id: string;
    label?: string;
    description?: string;
  }>;
  /** Última mensagem inbound do lead (vem de vars.lastIncomingMessage). */
  lastMessage: string;
  /** Tags atuais do lead — usado pra tag-bias heuristic. */
  leadTags?: Array<{ name?: string; slug?: string }>;
  /**
   * Evento que acordou o engine (`vars.lastEventName`). Quando setado e bate
   * com uma branch (via `eventBranchMap` ou `DEFAULT_EVENT_BRANCH_MAP`), o
   * fallback escolhe direto, sem olhar texto/tags. Confiança 1.0.
   */
  lastEventName?: string;
  /** Override do mapa default (vindo de `AI_DECISION.data.eventBranchMap`). */
  eventBranchMap?: Record<string, string>;
  /**
   * Payload do evento — pra eventos `lead-tagged`, o `extra.tagIds` permite
   * mapear "tag aplicada" → branch (ex: tag "Proposta Aceita" → aceitou).
   * Quando o usuário aplica uma tag manualmente, isso vira sinal forte.
   */
  lastEventData?: Record<string, unknown>;
  /**
   * Mapeamento de id de tag → id de branch. Quando o evento é `lead-tagged`
   * e uma das tagIds aplicadas bate com esse mapa, escolhe a branch direto.
   */
  tagBranchMap?: Record<string, string>;
  /**
   * Branch escolhida quando NÃO bate em nada (mensagem vazia, sem evento, sem
   * match heurístico). Crítico: o default histórico era `branches[0]`, o que
   * pode ser perigoso quando a primeira branch é uma ação destrutiva tipo
   * "aceitou" (dispara contrato). Workflows de fechamento DEVEM passar
   * `defaultBranchId: "sem_resposta"` pra que timeout vire follow-up, não venda.
   */
  defaultBranchId?: string;
}

export interface FallbackDecisionResult {
  chosenId: string;
  confidence: number;
  method: FallbackMethod;
  reason: string;
}

/**
 * Heurística pra escolher branch sem chamar LLM. Pondera:
 *  - Match direto (substring case-insensitive)
 *  - Token overlap (Jaccard)
 *  - Tag bias
 *
 * Retorna SEMPRE uma resposta (cai no default se nada bater).
 */
export function fallbackAiDecision(
  input: FallbackDecisionInput,
): FallbackDecisionResult {
  const {
    branches,
    lastMessage,
    leadTags = [],
    lastEventName,
    eventBranchMap,
    lastEventData,
    tagBranchMap,
    defaultBranchId,
  } = input;

  if (branches.length === 0) {
    return {
      chosenId: "main",
      confidence: 0,
      method: "default",
      reason: "Sem branches definidas",
    };
  }

  // ── 0a. Event-match: evento "soft" (proposal-accepted/contract-signed/...)
  // bate diretamente com uma branch. Confiança 1.0 — é sinal explícito do
  // app, sem ambiguidade. Override por nó respeita o `eventBranchMap`.
  if (lastEventName) {
    const mapped =
      (eventBranchMap?.[lastEventName] ?? DEFAULT_EVENT_BRANCH_MAP[lastEventName]) ||
      null;
    if (mapped && branches.some((b) => b.id === mapped)) {
      return {
        chosenId: mapped,
        confidence: 1.0,
        method: "event-match",
        reason: `Evento "${lastEventName}" → branch "${mapped}"`,
      };
    }

    // 0b. Lead recebeu tag manualmente → checa se a tag está mapeada
    if (lastEventName === "lead-tagged" && lastEventData && tagBranchMap) {
      const tagIdsRaw = lastEventData.tagIds;
      const tagIds = Array.isArray(tagIdsRaw) ? (tagIdsRaw as string[]) : [];
      for (const tid of tagIds) {
        const branchId = tagBranchMap[tid];
        if (branchId && branches.some((b) => b.id === branchId)) {
          return {
            chosenId: branchId,
            confidence: 1.0,
            method: "event-match",
            reason: `Tag aplicada (${tid}) → branch "${branchId}"`,
          };
        }
      }
    }
  }

  const msgLower = (lastMessage ?? "").toLowerCase().trim();
  if (!msgLower) {
    return defaultBranch(
      branches,
      "Mensagem do lead vazia (timeout ou evento sem texto)",
      defaultBranchId,
    );
  }

  const msgTokens = tokenize(msgLower);

  // ── 1. Match direto: msg contém id ou label da branch ───────────
  for (const b of branches) {
    const id = b.id.toLowerCase();
    const label = (b.label ?? "").toLowerCase();
    // Match exato OU substring do label completo
    if (id && (msgLower === id || msgLower.includes(id))) {
      return {
        chosenId: b.id,
        confidence: 1.0,
        method: "exact-match",
        reason: `Mensagem contém id "${b.id}"`,
      };
    }
    if (label && msgLower.includes(label)) {
      return {
        chosenId: b.id,
        confidence: 0.95,
        method: "exact-match",
        reason: `Mensagem contém label "${b.label}"`,
      };
    }
  }

  // ── 2. Match parcial: token overlap (Jaccard) ───────────────────
  const scored = branches.map((b) => {
    const branchText = [b.id, b.label ?? "", b.description ?? ""]
      .join(" ")
      .toLowerCase();
    const branchTokens = tokenize(branchText);
    const score = jaccardSimilarity(msgTokens, branchTokens);
    return { branch: b, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= 0.15) {
    let confidence = best.score;
    let bias = "";

    // ── 3. Tag bias: lead tem tag relacionada à branch ────────────
    const matchingTag = leadTags.find((t) => {
      const tName = (t.name ?? t.slug ?? "").toLowerCase();
      const bName = (best.branch.label ?? best.branch.id).toLowerCase();
      return tName && (tName.includes(bName) || bName.includes(tName));
    });
    if (matchingTag) {
      confidence = Math.min(1.0, confidence + 0.3);
      bias = ` + tag "${matchingTag.name ?? matchingTag.slug}" do lead`;
    }

    return {
      chosenId: best.branch.id,
      confidence,
      method: bias ? "tag-bias" : "keyword-match",
      reason: `Token overlap ${(best.score * 100).toFixed(0)}%${bias}`,
    };
  }

  // ── 4. Default ──────────────────────────────────────────────────
  return defaultBranch(
    branches,
    `Nenhuma branch teve match razoável (melhor: ${(best?.score ?? 0).toFixed(2)})`,
    defaultBranchId,
  );
}

function defaultBranch(
  branches: Array<{ id: string }>,
  reason: string,
  preferredId?: string,
): FallbackDecisionResult {
  // Prefere o `defaultBranchId` declarado pelo dev (seguro pra fluxos de
  // venda — ex: "sem_resposta" evita disparar contrato no timeout).
  // Cai pro primeiro só se o preferred não existir ou não foi passado.
  const preferred = preferredId
    ? branches.find((b) => b.id === preferredId)
    : null;
  const chosen = preferred ?? branches[0];
  return {
    chosenId: chosen.id,
    confidence: 0,
    method: "default",
    reason: preferred
      ? `${reason} → default explícito "${preferredId}"`
      : reason,
  };
}

// ── Texto ───────────────────────────────────────────────────────────
//
// AI_GENERATE_TEXT fallback — template seguro que respeita placeholders
// básicos do lead. Não tenta "gerar" nada criativo.

export interface FallbackTextInput {
  /** O prompt original (usado só pra escolher um template apropriado). */
  prompt: string;
  /** Nome do lead pra interpolação. */
  leadName?: string;
}

export interface FallbackTextResult {
  text: string;
  method: FallbackMethod;
  reason: string;
}

const TEXT_TEMPLATES = [
  "Oi {{name}}! 👋 Um atendente humano vai falar com você em instantes.",
  "Olá {{name}}, recebi sua mensagem. Vou te retornar em breve!",
  "{{name}}, obrigado pelo contato. Já estou olhando aqui pra você.",
];

export function fallbackAiText(input: FallbackTextInput): FallbackTextResult {
  // Pega um template aleatório pra parecer menos automático
  const template = TEXT_TEMPLATES[Math.floor(Math.random() * TEXT_TEMPLATES.length)];
  const text = template.replace("{{name}}", input.leadName ?? "");
  return {
    text: text.trim(),
    method: "template",
    reason: "Texto gerado via template (LLM indisponível)",
  };
}

// ── Vision/PDF ──────────────────────────────────────────────────────
//
// Sem LLM disponível, não tem como extrair conteúdo. Fallback é uma
// resposta segura que NÃO confunde o downstream (AI_DECISION subsequente
// vai cair no default por falta de contexto).

export function fallbackAiVision(): { extracted: string; method: FallbackMethod; reason: string } {
  return {
    extracted: "(análise de imagem indisponível — LLM offline)",
    method: "template",
    reason: "AI_VISION precisa de LLM real pra extração; fallback retorna placeholder",
  };
}

export function fallbackReadPdf(rawText: string): {
  summary: string;
  method: FallbackMethod;
  reason: string;
} {
  // Sem LLM pra resumir, retorna os primeiros 500 chars do texto bruto
  const preview = rawText.trim().slice(0, 500);
  return {
    summary: preview + (rawText.length > 500 ? "...[texto truncado]" : ""),
    method: "template",
    reason: "Resumo via LLM indisponível — retornando preview do texto bruto",
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\sáéíóúâêîôûãõñç]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3) // ignora palavras curtas (de, e, ou, etc)
      .map((t) => removeAccents(t)),
  );
}

function removeAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ── Critério pra decidir SE deve usar fallback (vs propagar erro) ──
//
// Erros recuperáveis (rate limit, timeout) NÃO devem cair pro fallback —
// melhor retry. Só erros "quota acabou" ou "key inválida" justificam
// fallback porque retry não resolve.

export function shouldUseFallback(errorCode: string): boolean {
  return [
    "QUOTA_EXCEEDED",
    "INVALID_KEY",
    "SERVER_ERROR", // 5xx persistente
    "INVALID_REQUEST", // prompt mal-formado, modelo errado
  ].includes(errorCode);
}
