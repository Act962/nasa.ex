import "server-only";
import type { Realtime } from "@inngest/realtime";
import type {
  NodeExecutor as ClassicNodeExecutor,
  StepTools,
} from "@/features/tracking-executions/types";
import type { NodeExecutor } from "../run-workflow";
import { fillAgentPlaceholders } from "./message-variables";
import { leadMessageFromTrigger } from "./trigger-lead-message";

/**
 * Roda no Modo Agente um passo do motor clássico, com o mesmo `data` que a janela do editor
 * grava (spec 0112): o que funciona no modo normal funciona igual aqui.
 *
 * Os executores clássicos só usam `step.run`; no Modo Agente o fluxo inteiro já roda dentro de
 * um `step.run` do motor, então o passo executa direto.
 */
const inlineStep = {
  run: async (_stepId: string, callback: () => unknown) => callback(),
} as unknown as StepTools;

// O aviso em tempo real é do canvas do modo normal; no Modo Agente o histórico fica no run.
const skipRealtimePublish = (async () => undefined) as unknown as Realtime.PublishFn;

/**
 * Passos gerados (ASTRO, modelos, construtor rápido) gravam os campos em `data.action`; a janela do
 * editor grava na raiz. Os dois ficam disponíveis, e a raiz (última edição) vence.
 */
function toClassicNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const actionFields =
    data.action && typeof data.action === "object" && !Array.isArray(data.action)
      ? (data.action as Record<string, unknown>)
      : {};
  const rootFields = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
  return { ...actionFields, ...rootFields };
}

// O lead que o passo devolve vem do Prisma (Decimal, Date); só campos simples seguem no contexto.
function toPlainLeadFields(lead: unknown): Record<string, unknown> | null {
  if (!lead || typeof lead !== "object") return null;
  const plainEntries = Object.entries(lead as Record<string, unknown>).flatMap(
    ([key, value]): [string, unknown][] => {
      if (value instanceof Date) return [[key, value.toISOString()]];
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
        return [[key, value]];
      }
      return [];
    },
  );
  return Object.fromEntries(plainEntries);
}

function toPlainJson(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function runClassicNodeInAgentMode(
  classicExecutor: ClassicNodeExecutor,
): NodeExecutor {
  return async ({ nodeId, data, context, dryRun }) => {
    if (dryRun) return { output: { dryRun: true } };

    const classicContext: Record<string, unknown> = {
      ...context.vars,
      lead: context.lead,
      leadMessage: leadMessageFromTrigger(context.trigger),
      realTime: false,
      workflowId: context.workflowId,
    };

    try {
      // As variáveis do modo normal ({{nome}}) ficam para o executor; as do Modo Agente
      // ({{lead.name}}, {{vars.x}}) já vão preenchidas.
      const nextContext = await classicExecutor({
        data: fillAgentPlaceholders(context, toClassicNodeData(data)),
        nodeId,
        context: classicContext,
        step: inlineStep,
        publish: skipRealtimePublish,
      });

      // O que o passo acrescentou ao contexto (ex.: `httpResponse`, `sei`) vira variável do fluxo.
      const addedVars = Object.fromEntries(
        Object.entries(nextContext).filter(
          ([key, value]) =>
            key !== "lead" &&
            key !== "leadMessage" &&
            key !== "realTime" &&
            key !== "workflowId" &&
            value !== classicContext[key],
        ),
      );
      const updatedLead = toPlainLeadFields(nextContext.lead);
      return {
        output: {
          ...(updatedLead ? { lead: updatedLead } : {}),
          vars: toPlainJson(addedVars),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { output: { error: errorMessage }, status: "FAILED", errorMessage };
    }
  };
}
