import "server-only";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  diagnoseFlow,
  type FlowChannelProvider,
  type FlowDiagnostic,
} from "@/features/workflows/lib/flow-diagnostics";
import { BLUEPRINT_GENERATION_PROMPT } from "./blueprint-system-prompt";

// Geração de fluxo a partir de um pedido em texto (spec 0090, seção D), compartilhada pela
// ferramenta do orquestrador e pela ação "criar fluxo" do registro do ASTRO.

const BlueprintNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()),
  name: z.string().optional(),
});

const BlueprintEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  fromOutput: z.string().optional(),
  toInput: z.string().optional(),
});

const SuggestedTagSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  reason: z.string().optional(),
  aiDescription: z.string().max(300).optional(),
});

export const GeneratedBlueprintSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  suggestedTags: z.array(SuggestedTagSchema).default([]),
  nodes: z.array(BlueprintNodeSchema),
  edges: z.array(BlueprintEdgeSchema),
});

export type GeneratedBlueprint = z.infer<typeof GeneratedBlueprintSchema>;

const CHANNEL_LABEL: Record<FlowChannelProvider, string> = {
  meta: "API oficial do WhatsApp",
  uazapi: "WhatsApp não oficial",
  none: "sem número conectado",
};

export interface FlowTracking {
  id: string;
  name: string;
  provider: FlowChannelProvider;
}

/** O funil, só se for da empresa informada, com o tipo de número ligado a ele. */
export async function findFlowTracking(trackingId: string, organizationId: string): Promise<FlowTracking | null> {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true, name: true, whatsappInstance: { select: { provider: true } } },
  });
  if (!tracking) return null;
  const provider: FlowChannelProvider = !tracking.whatsappInstance
    ? "none"
    : tracking.whatsappInstance.provider === "META_CLOUD"
      ? "meta"
      : "uazapi";
  return { id: tracking.id, name: tracking.name, provider };
}

export async function generateFlowBlueprint(params: {
  intent: string;
  name?: string;
  provider: FlowChannelProvider;
}): Promise<GeneratedBlueprint> {
  const result = await generateObject({
    model: openai("gpt-4o"),
    schema: GeneratedBlueprintSchema,
    system: BLUEPRINT_GENERATION_PROMPT,
    prompt: [
      `Intent do user: ${params.intent}`,
      params.name ? `Nome desejado: "${params.name}"` : "",
      `Canal do funil: ${CHANNEL_LABEL[params.provider]}`,
      "",
      "Gere o blueprint JSON correspondente.",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.4,
    // Campos opcionais e `data` livre por nó: o modo estrito da OpenAI recusa.
    providerOptions: { openai: { strictJsonSchema: false } },
  });
  return result.object;
}

/** Erros e avisos do canal previstos para o fluxo gerado, antes de ele existir (RF-24). */
export function predictBlueprintProblems(blueprint: GeneratedBlueprint, provider: FlowChannelProvider): FlowDiagnostic[] {
  return diagnoseFlow(
    blueprint.nodes,
    blueprint.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      sourceHandle: edge.fromOutput,
    })),
    { provider },
  );
}
