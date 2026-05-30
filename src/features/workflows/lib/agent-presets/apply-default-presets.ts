/**
 * Cria os workflows-padrão num tracking novo. Chamado pelo
 * `trackings.create` logo após inserir o tracking + seeds básicos.
 *
 * Padrões aplicados (todos com `agentMode: true`, `isActive: false` —
 * o operador revisa e ativa depois):
 *
 *   1. Agente de Agendamento — NEW_LEAD → conversa IA → SEND_AGENDA
 *   2. Closer Comercial com Follow-up — Opção X + loop 1/3/5/7 dias
 *
 * Placeholders <<...>> ficam visíveis no canvas pro operador escolher
 * agenda, produto, tags e tracking de destino antes de ativar.
 *
 * Falha silenciosa: se algum preset crashar, loga warning e segue —
 * NÃO derruba o tracking.create.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { createId } from "@paralleldrive/cuid2";
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

type BlueprintFn =
  | ((params: AgendamentoParams) => ReturnType<typeof buildAgendamentoBlueprint>)
  | ((
      params: SeedCloserComFollowupParams,
    ) => ReturnType<typeof buildCloserComFollowupBlueprint>)
  | ((
      params: PropostaContratoParams,
    ) => ReturnType<typeof buildPropostaContratoBlueprint>)
  | ((
      params: BoasVindasNasaRouteParams,
    ) => ReturnType<typeof buildBoasVindasNasaRouteBlueprint>);

interface PresetSpec {
  builder: BlueprintFn;
  /** Adicional de description já vai no blueprint — só usado em logs. */
  logName: string;
}

const DEFAULT_PRESETS: PresetSpec[] = [
  { builder: buildAgendamentoBlueprint, logName: "Agente de Agendamento" },
  {
    builder: buildCloserComFollowupBlueprint as BlueprintFn,
    logName: "Closer Comercial com Follow-up",
  },
  {
    builder: buildPropostaContratoBlueprint as BlueprintFn,
    logName: "Proposta + Contrato — Fechamento Automático",
  },
  {
    builder: buildBoasVindasNasaRouteBlueprint as BlueprintFn,
    logName: "Boas-vindas NASA Route — Pós-pagamento",
  },
];

interface ApplyParams {
  prisma: PrismaClient;
  organizationId: string;
  trackingId: string;
}

export async function applyDefaultAgentPresets({
  prisma,
  organizationId,
  trackingId,
}: ApplyParams): Promise<Array<{ workflowId: string; name: string }>> {
  const created: Array<{ workflowId: string; name: string }> = [];

  for (const preset of DEFAULT_PRESETS) {
    try {
      const blueprint = (
        preset.builder as (
          p: AgendamentoParams,
        ) => ReturnType<typeof buildAgendamentoBlueprint>
      )({ organizationId, trackingId });

      await prisma.$transaction(async (tx) => {
        const workflow = await tx.workflow.create({
          data: {
            id: createId(),
            name: blueprint.name,
            description: blueprint.description,
            trackingId,
            agentMode: true,
            maxRunsPerHour: 60,
            isActive: false,
          },
        });

        // Mapa de IDs declarativos → cuid reais
        const idMap = new Map<string, string>();
        for (const n of blueprint.nodes) {
          const realId = createId();
          idMap.set(n.id, realId);
          await tx.node.create({
            data: {
              id: realId,
              workflowId: workflow.id,
              name: String(n.type),
              type: n.type,
              position: n.position,
              data: n.data,
            },
          });
        }
        for (const e of blueprint.edges) {
          await tx.connection.create({
            data: {
              id: createId(),
              workflowId: workflow.id,
              fromNodeId: idMap.get(e.fromNodeId)!,
              toNodeId: idMap.get(e.toNodeId)!,
              fromOutput: e.fromOutput,
              toInput: e.toInput,
            },
          });
        }

        created.push({ workflowId: workflow.id, name: blueprint.name });
      });
    } catch (err) {
      console.warn(`[apply-default-presets] ${preset.logName} falhou`, err);
    }
  }

  return created;
}
