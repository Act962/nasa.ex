/**
 * Preset "Troca de Contato — QR Linnker" — fecha o ciclo do QR de
 * contato do Linnker:
 *
 *   1. Dono mostra QR Code no evento (botão ao lado da foto no
 *      perfil público).
 *   2. Pessoa escaneia → redirect `/l/<slug>/wa` registra
 *      `LinnkerScan` com UTM + UA + IP, redireciona pra wa.me.
 *   3. Pessoa envia mensagem no WhatsApp do dono.
 *   4. **Este workflow é acionado** por `MESSAGE_INCOMING`:
 *      a. AI_DECISION: "Veio de scan QR Linnker recente?" — usa
 *         `lead.utmSource` ou consulta `match-scan-to-lead` (≤ 24h
 *         entre scan e mensagem).
 *      b. Se sim:
 *         - TAG "QR Linnker" (visibilidade no kanban + filtros).
 *         - SEND_MESSAGE de boas-vindas com link do .vcf:
 *           "Oi {{lead.firstName}}! 👋 Obrigado por escanear meu QR.
 *           Aqui está meu cartão de contato: {{vcardUrl}}"
 *      c. Se não: end (não interfere com outros fluxos do tracking).
 *
 * UX da troca: pessoa que escaneou tem dados de contato do dono
 * salvos no WhatsApp (via mensagem com link .vcf) E entra no
 * tracking dele com tag "QR Linnker" pra follow-up posterior.
 *
 * Customização:
 *   - Texto da resposta pode ser editado no node SEND_MESSAGE.
 *   - Janela de tempo (24h) pode ser ajustada no AI_DECISION prompt.
 *   - Pode-se adicionar follow-up (WAIT + SEND_MESSAGE) na branch
 *     "sim" pra contatos sem resposta após X dias.
 */

import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";

export interface QrLinnkerExchangeParams {
  organizationId: string;
  trackingId: string;
  /** Slug do LinnkerPage do dono — alimenta a URL do .vcf na resposta. */
  linnkerSlug: string;
  /** ID da tag "QR Linnker" criada via suggestedTags. */
  tagQrLinnkerId?: string;
  /** Override do nome do workflow (default: "Troca de Contato — QR Linnker"). */
  name?: string;
  /** Base URL pública do app (pra montar `{vcardUrl}`). */
  publicAppUrl?: string;
}

export function buildQrLinnkerExchangeBlueprint(
  params: QrLinnkerExchangeParams,
) {
  const PH_TAG = params.tagQrLinnkerId ?? "<<TAG_QR_LINNKER_ID>>";
  const baseUrl =
    params.publicAppUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://nasaex.com.br";
  const vcardUrl = `${baseUrl}/api/linnker/${params.linnkerSlug}/vcard`;

  const ids = {
    trigger: "trg-msg-incoming",
    decideQr: "ai-decide-qr-scan",
    tagQr: "tag-qr-linnker",
    msgWelcome: "msg-welcome-vcard",
  } as const;

  type Node = {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };

  const nodes: Node[] = [
    // ── Trigger: lead manda 1ª mensagem no WhatsApp ─────────
    {
      id: ids.trigger,
      type: NodeType.MESSAGE_INCOMING,
      position: { x: 0, y: 0 },
      data: {
        // Só inbound (mensagens do lead, não do agente)
        action: { directionFilter: "inbound" },
      },
    },

    // ── AI_DECISION: detecta scan recente ────────────────────
    // O agente lê o `lead.linnkerScans` (latest, ≤ 24h) injetado
    // pelo runtime e decide.
    {
      id: ids.decideQr,
      type: NodeType.AI_DECISION,
      position: { x: 0, y: 200 },
      data: {
        instruction:
          "Esse lead chegou pelo QR Linnker? Considere: (1) se há LinnkerScan registrado com mesmo phone OU User-Agent nos últimos 24h, OU (2) se a mensagem contém menção clara a 'QR', 'escaneei', 'evento' nos primeiros 200 chars. Em caso de dúvida, classifique como 'nao'.",
        branches: [
          { id: "sim", label: "Veio do QR" },
          { id: "nao", label: "Não" },
        ],
      },
    },

    // ── TAG "QR Linnker" ────────────────────────────────────
    {
      id: ids.tagQr,
      type: NodeType.TAG,
      position: { x: -200, y: 400 },
      data: {
        action: { tagIds: [PH_TAG] },
      },
    },

    // ── SEND_MESSAGE: boas-vindas + link vCard ──────────────
    {
      id: ids.msgWelcome,
      type: NodeType.SEND_MESSAGE,
      position: { x: -200, y: 600 },
      data: {
        action: {
          message:
            `Oi {{lead.firstName}}! 👋 Que bom te conhecer!\n\n` +
            `Aqui está meu cartão de contato pra você salvar: ${vcardUrl}\n\n` +
            `Posso te ajudar com algo?`,
        },
      },
    },
  ];

  const edges = [
    { id: createId(), fromNodeId: ids.trigger, toNodeId: ids.decideQr, fromOutput: "main", toInput: "main" },
    // Branch sim → tag → msg
    { id: createId(), fromNodeId: ids.decideQr, toNodeId: ids.tagQr, fromOutput: "sim", toInput: "main" },
    { id: createId(), fromNodeId: ids.tagQr, toNodeId: ids.msgWelcome, fromOutput: "main", toInput: "main" },
    // Branch nao → end (sem edge, encerra naturalmente)
  ];

  return {
    name: params.name ?? "Troca de Contato — QR Linnker",
    description:
      "Acionado quando um lead manda 1ª mensagem no WhatsApp. Detecta se veio do QR do Linnker (LinnkerScan recente ou texto da mensagem), aplica tag 'QR Linnker' e responde com link do vCard.",
    suggestedTags: [
      {
        slug: "qr-linnker",
        name: "QR Linnker",
        color: "#8B5CF6",
        reason:
          "Identifica leads que escanearam o QR do Linnker pra follow-up segmentado",
      },
    ],
    nodes,
    edges,
  };
}
