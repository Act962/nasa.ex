/**
 * Cria os workflows-padrão num tracking novo. Chamado pelo
 * `trackings.create` logo após inserir o tracking + seeds básicos.
 *
 * Aceita filtro opcional `slug` pra aplicar APENAS 1 preset (usado pela
 * IA generativa do Astro — user pede "aplica boas-vindas NASA Route" e
 * só esse roda). Sem `slug`, aplica TODOS os 4 (comportamento original
 * do `trackings.create`).
 *
 * Presets disponíveis (todos `agentMode: true`, `isActive: false` —
 * operador revisa e ativa depois):
 *   - "agendamento" — NEW_LEAD → conversa IA → SEND_AGENDA
 *   - "closer-followup" — Opção X + loop 1/3/5/7 dias
 *   - "proposta-contrato" — cadência D+0/3/7/15/30 + contrato com 3 toques
 *   - "boas-vindas-nasa-route" — PAYMENT_RECEIVED → email + WhatsApp
 *
 * Placeholders <<...>> ficam visíveis no canvas pro operador escolher
 * agenda, produto, tags e tracking de destino antes de ativar.
 *
 * Falha silenciosa: se um preset crashar, loga warning e segue — NÃO
 * derruba o caller (tracking.create).
 */
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildAgendamentoBlueprint,
  type AgendamentoParams,
} from "./agendamento";
import {
  buildCloserComFollowupBlueprint,
  type SeedCloserComFollowupParams,
} from "./closer-com-followup";
import {
  buildPropostaContratoBlueprint,
  type PropostaContratoParams,
} from "./proposta-contrato";
import {
  buildBoasVindasNasaRouteBlueprint,
  type BoasVindasNasaRouteParams,
} from "./boas-vindas-nasa-route";
import {
  createWorkflowFromBlueprint,
  type Blueprint,
} from "./create-from-blueprint";

export type PresetSlug =
  | "agendamento"
  | "closer-followup"
  | "proposta-contrato"
  | "boas-vindas-nasa-route";

type BlueprintBuilder = (params: {
  organizationId: string;
  trackingId: string;
}) => Blueprint;

interface PresetSpec {
  slug: PresetSlug;
  builder: BlueprintBuilder;
  logName: string;
}

const DEFAULT_PRESETS: PresetSpec[] = [
  {
    slug: "agendamento",
    builder: buildAgendamentoBlueprint as BlueprintBuilder,
    logName: "Agente de Agendamento",
  },
  {
    slug: "closer-followup",
    builder: buildCloserComFollowupBlueprint as unknown as BlueprintBuilder,
    logName: "Closer Comercial com Follow-up",
  },
  {
    slug: "proposta-contrato",
    builder: buildPropostaContratoBlueprint as unknown as BlueprintBuilder,
    logName: "Proposta + Contrato — Fechamento Automático",
  },
  {
    slug: "boas-vindas-nasa-route",
    builder: buildBoasVindasNasaRouteBlueprint as unknown as BlueprintBuilder,
    logName: "Boas-vindas NASA Route — Pós-pagamento",
  },
];

interface ApplyParams {
  prisma: PrismaClient;
  organizationId: string;
  trackingId: string;
  /**
   * User que será dono dos workflows criados. Quando aplicado por
   * trackings.create (sem user explícito), pega o user que criou o
   * tracking. Quando aplicado pela IA do Astro, é o user logado.
   */
  userId: string;
  /**
   * Filtra pra aplicar apenas 1 preset. Sem isso, aplica TODOS os 4.
   * Usado pela tool `apply_workflow_preset` do Astro.
   */
  slug?: PresetSlug;
}

export async function applyDefaultAgentPresets({
  prisma,
  organizationId,
  trackingId,
  userId,
  slug,
}: ApplyParams): Promise<Array<{ workflowId: string; name: string }>> {
  const targets = slug
    ? DEFAULT_PRESETS.filter((p) => p.slug === slug)
    : DEFAULT_PRESETS;

  if (slug && targets.length === 0) {
    console.warn(`[apply-default-presets] slug "${slug}" não encontrado`);
    return [];
  }

  const created: Array<{ workflowId: string; name: string }> = [];

  for (const preset of targets) {
    try {
      const blueprint = preset.builder({ organizationId, trackingId });

      const result = await prisma.$transaction(async (tx) => {
        const r = await createWorkflowFromBlueprint(tx, {
          trackingId,
          userId,
          blueprint,
          agentMode: true,
          isActive: false,
          maxRunsPerHour: 60,
        });
        return r;
      });

      created.push({ workflowId: result.workflowId, name: blueprint.name });
    } catch (err) {
      console.warn(`[apply-default-presets] ${preset.logName} falhou`, err);
    }
  }

  return created;
}

/**
 * Metadata pública dos presets — usado pela tool `list_workflow_presets`
 * pra o LLM saber quais opções existem antes de chamar `apply_preset`.
 */
export const PRESET_CATALOG: Array<{
  slug: PresetSlug;
  name: string;
  description: string;
}> = [
  {
    slug: "agendamento",
    name: "Agente de Agendamento",
    description:
      "NEW_LEAD → IA gera saudação personalizada → SEND_MESSAGE → espera resposta 24h → AI_DECISION (quer agendar?) → se sim: SEND_AGENDA + boas-vindas pós-confirmação; se não: tag 'Sem interesse'. ~12 nós.",
  },
  {
    slug: "closer-followup",
    name: "Closer Comercial + Follow-up",
    description:
      "Multi-trigger (NEW_LEAD ou MESSAGE_INCOMING) → menu de 3 botões via SEND_MESSAGE → AI_DECISION roteia → LOOP_OVER 4 toques (1/3/5/7 dias) → tag 'Aprovado' + move pra coluna fechado. ~18 nós.",
  },
  {
    slug: "proposta-contrato",
    name: "Proposta + Contrato — Fechamento Automático",
    description:
      "LEAD_TAGGED(<<gatilho>>) → SEND_PROPOSAL → cadência longa D+0/3/7/15/30 (5 toques) com 5 eventos em race (proposal-accepted/rejected, message-incoming, lead-tagged, lead-status-changed) → se aceitou: SEND_CONTRACT com 3 toques de assinatura → tag 'Sem interesse' no fim. 30 nós, 38 conexões.",
  },
  {
    slug: "boas-vindas-nasa-route",
    name: "Boas-vindas NASA Route — Pós-pagamento",
    description:
      "PAYMENT_RECEIVED (enriquecido com courseTitle/playerUrl) → tag 'Aluno NASA Route' → SEND_EMAIL boas-vindas (template caprichado React Email) → WAIT 1min → SEND_MESSAGE WhatsApp + link → WAIT 3d → SEND_MESSAGE check-in. 7 nós.",
  },
];
