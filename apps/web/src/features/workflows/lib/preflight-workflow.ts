/**
 * Preflight de runtime do workflow — checa dependências externas que só dá
 * pra saber consultando o banco/env, antes de simular ou ativar.
 *
 * Complementa `validateNode` (campos do nó) e `validateWorkflowGraph`
 * (estrutura do grafo). Aqui validamos:
 *  - Instância WhatsApp conectada (pra SEND_MESSAGE/SEND_MEDIA/SEND_VOICE)
 *  - AI key configurada (pra AI_DECISION/AI_GENERATE_TEXT/AI_VISION com
 *    provider custom)
 *  - Placeholders `{{lead.X}}` apontam pra path conhecido
 *  - Tracking dono não arquivado
 *  - Workflow ativo (warning, não bloqueio)
 */
import prisma from "@/lib/prisma";

export type PreflightSeverity = "error" | "warning" | "info";

export type PreflightCheck = {
  nodeId: string | null;
  severity: PreflightSeverity;
  code:
    | "WHATSAPP_DISCONNECTED"
    | "WHATSAPP_MISSING"
    | "WHATSAPP_IN_CHAT_FALLBACK"
    | "AI_KEY_MISSING"
    | "INVALID_PLACEHOLDER"
    | "TRACKING_INACTIVE"
    | "WORKFLOW_INACTIVE";
  message: string;
};

export type PreflightResult = {
  pass: boolean;
  checks: PreflightCheck[];
};

/** Paths conhecidos do lead — usados pra validar placeholders `{{lead.X}}`. */
const KNOWN_LEAD_PATHS = new Set([
  "id",
  "name",
  "email",
  "phone",
  "statusId",
  "trackingId",
  "responsibleId",
  "isActive",
  "amount",
  "order",
  "device",
  "source",
  "profile",
  "utmTerm",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "closedAt",
  "ctwaClid",
  "document",
  "metaAdId",
  "createdAt",
  "updatedAt",
  "statusFlow",
  "currentAction",
]);

const PLACEHOLDER_REGEX = /\{\{\s*lead\.([a-zA-Z0-9_]+)\s*\}\}/g;

const MESSAGING_NODE_TYPES = new Set([
  "SEND_MESSAGE",
  "SEND_MEDIA",
  "SEND_VOICE",
]);

const AI_NODE_TYPES = new Set([
  "AI_DECISION",
  "AI_GENERATE_TEXT",
  "AI_VISION",
]);

function unwrapAction(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const d = data ?? {};
  if (d.action && typeof d.action === "object" && !Array.isArray(d.action)) {
    return d.action as Record<string, unknown>;
  }
  return d;
}

/** Extrai todo texto de mensagem de um node SEND_MESSAGE/SEND_MEDIA/SEND_VOICE. */
function extractMessageText(
  data: Record<string, unknown> | null | undefined,
): string {
  const action = unwrapAction(data);
  const payload = action.payload as Record<string, unknown> | undefined;
  if (!payload) return "";
  const parts: string[] = [];
  // text message
  if (typeof payload.message === "string") parts.push(payload.message);
  if (typeof payload.caption === "string") parts.push(payload.caption);
  if (typeof payload.text === "string") parts.push(payload.text);
  // buttons / list items podem ter texto
  if (Array.isArray(payload.buttons)) {
    for (const b of payload.buttons) {
      if (typeof b === "object" && b && "text" in b) {
        const t = (b as { text?: string }).text;
        if (typeof t === "string") parts.push(t);
      }
    }
  }
  return parts.join(" ");
}

export async function preflightWorkflow(args: {
  workflowId: string;
}): Promise<PreflightResult> {
  const { workflowId } = args;
  // Carregado sem `aiSettings` no select principal — algumas DBs ainda
  // não aplicaram a migration de campos AI (aiApiKey etc) e o Prisma
  // exploda com ColumnNotFound. AI key é checado abaixo via $queryRaw
  // com try/catch que tolera schema desatualizado.
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      nodes: { select: { id: true, type: true, data: true } },
      tracking: {
        select: {
          id: true,
          isArchived: true,
          whatsappInstance: {
            select: {
              id: true,
              status: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const checks: PreflightCheck[] = [];

  if (!workflow) {
    return {
      pass: false,
      checks: [
        {
          nodeId: null,
          severity: "error",
          code: "WORKFLOW_INACTIVE",
          message: "Workflow não encontrado.",
        },
      ],
    };
  }

  // ── TRACKING_INACTIVE ───────────────────────────────────────────────
  if (workflow.tracking?.isArchived) {
    checks.push({
      nodeId: null,
      severity: "error",
      code: "TRACKING_INACTIVE",
      message: "Tracking dono do workflow está arquivado — workflow não executa.",
    });
  }

  // ── WORKFLOW_INACTIVE ───────────────────────────────────────────────
  if (!workflow.isActive) {
    checks.push({
      nodeId: null,
      severity: "info",
      code: "WORKFLOW_INACTIVE",
      message:
        "Workflow está desativado. Teste roda mesmo assim, mas ele não dispara em produção.",
    });
  }

  // ── WHATSAPP_* ──────────────────────────────────────────────────────
  const messagingNodes = workflow.nodes.filter((n) =>
    MESSAGING_NODE_TYPES.has(n.type),
  );
  if (messagingNodes.length > 0) {
    const instance = workflow.tracking?.whatsappInstance;
    if (!instance) {
      for (const n of messagingNodes) {
        checks.push({
          nodeId: n.id,
          severity: "error",
          code: "WHATSAPP_MISSING",
          message:
            "Nenhuma instância WhatsApp conectada ao tracking. Configure uma em Tracking → WhatsApp.",
        });
      }
    } else if (instance.status === "DISCONNECTED" || !instance.isActive) {
      for (const n of messagingNodes) {
        checks.push({
          nodeId: n.id,
          severity: "error",
          code: "WHATSAPP_DISCONNECTED",
          message:
            "Instância WhatsApp do tracking está DESCONECTADA. Reconecte antes de rodar — mensagens vão falhar.",
        });
      }
    }
  }

  // ── AI_KEY_MISSING ──────────────────────────────────────────────────
  const aiNodes = workflow.nodes.filter((n) => AI_NODE_TYPES.has(n.type));
  if (aiNodes.length > 0 && workflow.tracking) {
    try {
      const rows = (await prisma.$queryRaw`
        SELECT ai_api_key FROM ai_setting
        WHERE "trackingId" = ${workflow.tracking.id}
        LIMIT 1
      `) as Array<{ ai_api_key: string | null }>;
      const hasCustomKey = !!rows[0]?.ai_api_key;
      const hasSecretsEnv = !!process.env.AI_SECRETS_KEY;
      // Custom provider precisa de aiApiKey + AI_SECRETS_KEY (pra
      // decriptar). Sem custom key, cai no provider default — sem erro.
      if (hasCustomKey && !hasSecretsEnv) {
        for (const n of aiNodes) {
          checks.push({
            nodeId: n.id,
            severity: "error",
            code: "AI_KEY_MISSING",
            message:
              "Tracking tem API key customizada mas a env AI_SECRETS_KEY está ausente — não dá pra decriptar. Avise o admin da plataforma.",
          });
        }
      }
    } catch {
      // DB sem coluna ai_api_key (migration não aplicada) — ignora
      // silenciosamente; AI key acaba caindo no provider default.
    }
  }

  // ── INVALID_PLACEHOLDER ─────────────────────────────────────────────
  for (const n of workflow.nodes) {
    if (!MESSAGING_NODE_TYPES.has(n.type)) continue;
    const text = extractMessageText(n.data as Record<string, unknown> | null);
    if (!text) continue;
    const unknownPaths = new Set<string>();
    let match: RegExpExecArray | null;
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      const path = match[1];
      if (!KNOWN_LEAD_PATHS.has(path)) unknownPaths.add(path);
    }
    if (unknownPaths.size > 0) {
      checks.push({
        nodeId: n.id,
        severity: "warning",
        code: "INVALID_PLACEHOLDER",
        message: `Placeholder(s) {{lead.${[...unknownPaths].join("}}, {{lead.")}}} apontam pra campo(s) que não existem no Lead. Vai sair como string vazia em runtime.`,
      });
    }
  }

  return {
    pass: checks.every((c) => c.severity !== "error"),
    checks,
  };
}
