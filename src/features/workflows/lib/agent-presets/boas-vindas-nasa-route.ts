/**
 * Preset "Boas-vindas NASA Route" — disparado quando lead paga um curso
 * NASA Route. Funciona em conjunto com o purchase-side-effects do NASA
 * Route que emite PAYMENT_RECEIVED enriquecido com dados do curso
 * (courseTitle, planName, coursePlayerUrl) no triggerPayload.
 *
 * Estrutura (7 nodes, sequencial):
 *
 *   PAYMENT_RECEIVED
 *     → TAG "Aluno NASA Route"
 *     → SEND_EMAIL welcome-course (React Email caprichado)
 *     → WAIT 1min (espaçamento entre canais)
 *     → SEND_MESSAGE WhatsApp boas-vindas + link
 *     → WAIT 3 dias
 *     → SEND_MESSAGE check-in "como tá indo?"
 *
 * Sobre cobrança de carrinho abandonado: NÃO é deste workflow. O cron
 * separado `nasa-route-cart-recovery` cuida de varrer
 * PendingCoursePurchase PENDING e mandar emails de recuperação
 * (D+1/D+3/D+7/D+15 → ABANDONED após 30d).
 *
 * Placeholders <<...>> a substituir no canvas:
 *   <<TAG_ALUNO_NASA_ROUTE_ID>>   Tag aplicada após pagamento
 */
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";

export interface BoasVindasNasaRouteParams {
  organizationId: string;
  trackingId: string;
  name?: string;
  /** Tag "Aluno NASA Route" — aplicada após pagamento confirmar. */
  tagAlunoId?: string;
  /** Em quantos minutos rodar o check-in (default 3d = 4320). */
  checkinAfterMinutes?: number;
}

export function buildBoasVindasNasaRouteBlueprint(
  params: BoasVindasNasaRouteParams,
) {
  const checkinMinutes = params.checkinAfterMinutes ?? 4320; // 3d em prod
  const PH_TAG_ALUNO = params.tagAlunoId ?? "<<TAG_ALUNO_NASA_ROUTE_ID>>";

  const ids = {
    trigger: "trg-payment-received",
    tagAluno: "act-tag-aluno",
    sendEmail: "act-send-email-welcome",
    waitGap: "ctl-wait-1min",
    sendWhatsapp: "act-send-whatsapp-welcome",
    waitCheckin: "ctl-wait-checkin",
    sendCheckin: "act-send-checkin",
  } as const;

  const nodes: Array<{
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }> = [
    {
      id: ids.trigger,
      type: NodeType.PAYMENT_RECEIVED,
      position: { x: 0, y: 0 },
      data: { action: { conditions: [] } },
    },
    {
      id: ids.tagAluno,
      type: NodeType.TAG,
      position: { x: 320, y: 0 },
      data: { action: { type: "ADD", tagsIds: [PH_TAG_ALUNO] } },
    },
    {
      id: ids.sendEmail,
      type: NodeType.SEND_EMAIL,
      position: { x: 640, y: 0 },
      data: {
        action: {
          template: "welcome-course",
          subject:
            "Bem-vindo(a) ao NASA Route — acesso ao curso liberado 🚀",
          templateProps: {
            // Interpolação acontece no executor — strings com {{...}} são
            // resolvidas a partir do contexto (lead, trigger, vars).
            studentName: "{{trigger.studentName}}",
            courseTitle: "{{trigger.courseTitle}}",
            planName: "{{trigger.planName}}",
            creatorName: "NASA Agents",
            coursePlayerUrl: "{{trigger.coursePlayerUrl}}",
          },
        },
      },
    },
    {
      id: ids.waitGap,
      type: NodeType.WAIT,
      position: { x: 960, y: 0 },
      data: { action: { type: "minutes", minutes: 1 } },
    },
    {
      id: ids.sendWhatsapp,
      type: NodeType.SEND_MESSAGE,
      position: { x: 1280, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Show, {{lead.name}}! 🚀 Acabei de confirmar seu acesso ao curso *{{trigger.courseTitle}}* ({{trigger.planName}}).\n\nVocê também recebeu um email com o link. Pra acessar direto, é só clicar: {{trigger.coursePlayerUrl}}\n\nQualquer dúvida, é só responder por aqui que eu te ajudo. Bom estudo!",
          },
        },
      },
    },
    {
      id: ids.waitCheckin,
      type: NodeType.WAIT,
      position: { x: 1600, y: 0 },
      data: { action: { type: "minutes", minutes: checkinMinutes } },
    },
    {
      id: ids.sendCheckin,
      type: NodeType.SEND_MESSAGE,
      position: { x: 1920, y: 0 },
      data: {
        action: {
          payload: {
            type: "TEXT",
            message:
              "Oi {{lead.name}}, tudo certo com o curso? Já assistiu alguma aula? Se tiver alguma dúvida ou quiser sugestão de por onde começar, é só me chamar. 👋",
          },
        },
      },
    },
  ];

  const edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromOutput: string;
    toInput: string;
  }> = [
    { id: createId(), fromNodeId: ids.trigger, toNodeId: ids.tagAluno, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.tagAluno, toNodeId: ids.sendEmail, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.sendEmail, toNodeId: ids.waitGap, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.waitGap, toNodeId: ids.sendWhatsapp, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.sendWhatsapp, toNodeId: ids.waitCheckin, fromOutput: "main", toInput: "main" },
    { id: createId(), fromNodeId: ids.waitCheckin, toNodeId: ids.sendCheckin, fromOutput: "main", toInput: "main" },
  ];

  return {
    name: params.name ?? "Boas-vindas NASA Route — Pós-pagamento",
    description:
      "Quando o lead paga um curso NASA Route, aplica tag 'Aluno', envia email caprichado de boas-vindas (Resend + React Email), mensagem WhatsApp com link do curso, e check-in 3 dias depois. Reage ao PAYMENT_RECEIVED enriquecido pelo purchase-side-effects (que injeta courseTitle/planName/coursePlayerUrl no contexto via {{trigger.X}}).",
    nodes,
    edges,
  };
}
