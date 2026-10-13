/**
 * Estado visual de uma `FormResponses` para o badge no card do lead.
 *
 * Branco       — form iniciado, NENHUM campo respondido.
 * Azul         — em preenchimento (criado ou tocado nas últimas 24h).
 * Laranja      — aguardando assinatura do cliente (SignatureClient).
 * Vermelho     — > 24h sem atualização ou aguardando assinatura do
 *                responsável (gate de SignatureUser não satisfeito).
 * Verde        — todos os campos obrigatórios preenchidos + gates
 *                de assinatura satisfeitos.
 *
 * A função analisa o `jsonResponse` salvo + o `jsonBlock` do form pra
 * determinar o estado. Server-side, retorna só uma string — economiza
 * banda no kanban (não envia jsonBlock/jsonResponse pro cliente).
 */

export type FormResponseState =
  | "empty"
  | "in_progress"
  | "waiting_client_signature"
  | "stale"
  | "complete";

export const STATE_COLOR: Record<FormResponseState, string> = {
  empty: "#ffffff",
  in_progress: "#3b82f6", // azul
  waiting_client_signature: "#f59e0b", // laranja
  stale: "#ef4444", // vermelho
  complete: "#10b981", // verde
};

export const STATE_LABEL: Record<FormResponseState, string> = {
  empty: "Iniciado — sem respostas",
  in_progress: "Em preenchimento",
  waiting_client_signature: "Aguardando assinatura do cliente",
  stale: "Sem mexidas há 24h ou aguardando responsável",
  complete: "Preenchido",
};

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const SYSTEM_KEYS = new Set(["user_name", "user_email", "user_phone"]);

type AnyBlock = {
  id?: string;
  blockType?: string;
  attributes?: {
    required?: boolean;
    assigneeUserId?: string | null;
  };
  childblocks?: AnyBlock[];
};

type ParsedResponse = Record<
  string,
  { value?: unknown; meta?: Record<string, unknown> } | string | unknown
>;

/**
 * Walk the form's jsonBlock e devolve dois grupos:
 *  - requiredFieldIds: blocos preenchíveis marcados como required
 *  - signatureUserGates: SignatureUser com `assigneeUserId` (gate)
 *  - signatureClientIds: SignatureClient (assinatura do cliente)
 */
function indexFormBlocks(jsonBlock: unknown) {
  const requiredFieldIds = new Set<string>();
  const signatureUserGates = new Set<string>();
  const signatureClientIds = new Set<string>();

  let parsed: unknown = jsonBlock;
  if (typeof jsonBlock === "string") {
    try {
      parsed = JSON.parse(jsonBlock);
    } catch {
      return { requiredFieldIds, signatureUserGates, signatureClientIds };
    }
  }

  function visit(node: AnyBlock | null | undefined) {
    if (!node || typeof node !== "object") return;
    const id = node.id;
    const type = node.blockType;
    const required = !!node.attributes?.required;
    if (typeof id === "string") {
      if (type === "SignatureUser") {
        if (node.attributes?.assigneeUserId) {
          signatureUserGates.add(id);
        } else if (required) {
          requiredFieldIds.add(id);
        }
      } else if (type === "SignatureClient") {
        signatureClientIds.add(id);
        if (required) requiredFieldIds.add(id);
      } else if (required) {
        requiredFieldIds.add(id);
      }
    }
    if (Array.isArray(node.childblocks)) {
      for (const c of node.childblocks) visit(c);
    }
  }

  if (Array.isArray(parsed)) {
    for (const node of parsed as AnyBlock[]) visit(node);
  }
  return { requiredFieldIds, signatureUserGates, signatureClientIds };
}

function parseResponse(jsonResponse: unknown): ParsedResponse {
  if (!jsonResponse) return {};
  if (typeof jsonResponse === "string") {
    try {
      return JSON.parse(jsonResponse) as ParsedResponse;
    } catch {
      return {};
    }
  }
  if (typeof jsonResponse === "object") {
    return jsonResponse as ParsedResponse;
  }
  return {};
}

function hasValue(entry: unknown): boolean {
  if (entry == null) return false;
  if (typeof entry === "string") return entry.trim().length > 0;
  if (typeof entry === "object") {
    const e = entry as { value?: unknown };
    return typeof e.value === "string" && e.value.trim().length > 0;
  }
  return false;
}

export function deriveResponseState(input: {
  jsonResponse: unknown;
  jsonBlock: unknown;
  createdAt: Date | string;
}): FormResponseState {
  const parsed = parseResponse(input.jsonResponse);
  // Filtra também chaves com prefixo `__` (meta-campos internos do
  // sistema, ex: `__groupsReached` do reset trigger do DatePicker).
  const userKeys = Object.keys(parsed).filter(
    (k) => !SYSTEM_KEYS.has(k) && !k.startsWith("__"),
  );
  const filledKeys = userKeys.filter((k) => hasValue(parsed[k]));

  // 1) Branco: nenhum campo (não-sistema) preenchido.
  if (filledKeys.length === 0) return "empty";

  const { requiredFieldIds, signatureUserGates, signatureClientIds } =
    indexFormBlocks(input.jsonBlock);

  // 2) Verde (complete): todos os required preenchidos + signaturas
  //    obrigatórias satisfeitas.
  const allRequiredFilled = Array.from(requiredFieldIds).every((id) =>
    hasValue(parsed[id]),
  );
  const allUserGatesSigned = Array.from(signatureUserGates).every((id) =>
    hasValue(parsed[id]),
  );
  const allClientSignaturesSigned = Array.from(signatureClientIds).every(
    (id) => hasValue(parsed[id]),
  );
  if (allRequiredFilled && allUserGatesSigned && allClientSignaturesSigned) {
    return "complete";
  }

  // 3) Vermelho: gate de SignatureUser não cumprido — bloqueia avanço.
  const hasUnsignedUserGate = Array.from(signatureUserGates).some(
    (id) => !hasValue(parsed[id]),
  );
  if (hasUnsignedUserGate) return "stale";

  // 4) Laranja: aguardando SignatureClient (cliente).
  const hasUnsignedClientSig = Array.from(signatureClientIds).some(
    (id) => !hasValue(parsed[id]),
  );
  if (hasUnsignedClientSig) return "waiting_client_signature";

  // 5) Stale por idade: criado há > 24h e ainda incompleto.
  const ageMs =
    Date.now() -
    new Date(input.createdAt).getTime();
  if (ageMs > STALE_THRESHOLD_MS) return "stale";

  // 6) Default: em preenchimento (recente).
  return "in_progress";
}
