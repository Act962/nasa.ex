// Origem de mensagem enviada por passo de fluxo (spec 0113, RF-20): fica no metadata da mensagem para o chat
// mostrar "Editar gatilho" e abrir o passo exato no editor. Sem `server-only`: o chat lê o mesmo formato.

// `type` e não `interface`: o metadata da mensagem é JSON, e interface não é aceita como objeto JSON pelo Prisma.
export type FlowMessageOrigin = {
  workflowId: string;
  nodeId: string;
};

/** Origem a partir do contexto do fluxo (os dois motores guardam `workflowId` nele) e do passo em execução. */
export function flowOriginOf(
  context: Record<string, unknown> | null | undefined,
  nodeId: string | null | undefined,
): FlowMessageOrigin | null {
  const workflowId = context?.workflowId;
  return typeof workflowId === "string" && workflowId && nodeId ? { workflowId, nodeId } : null;
}

/** Campo do metadata da mensagem; vazio quando a mensagem não veio de fluxo. */
export function flowOriginMetadata(origin: FlowMessageOrigin | null | undefined): { flowOrigin?: FlowMessageOrigin } {
  return origin ? { flowOrigin: origin } : {};
}

export function readFlowOrigin(metadata: unknown): FlowMessageOrigin | null {
  if (!metadata || typeof metadata !== "object") return null;
  const origin = (metadata as { flowOrigin?: unknown }).flowOrigin;
  if (!origin || typeof origin !== "object") return null;
  const { workflowId, nodeId } = origin as Partial<FlowMessageOrigin>;
  return typeof workflowId === "string" && workflowId && typeof nodeId === "string" && nodeId ? { workflowId, nodeId } : null;
}
