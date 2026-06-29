import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType, Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { Edge, Node } from "@xyflow/react";
import { z } from "zod";

export const getWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
    })
  )
  .output(
    z.object({
      workflow: z.custom<Workflow>(),
      nodes: z.array(z.custom<Node>()),
      edges: z.array(z.custom<Edge>()),
    })
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: input.workflowId,
      },
      include: { nodes: true, connections: true },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow não encontrado",
      });
    }

    const nodes: Node[] = workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position as { x: number; y: number },
      data: (node.data as Record<string, unknown>) || {},
    }));

    // Connection.fromOutput / toInput guardam SEMÂNTICA pra engine
    // (ex: "loop", "done", "true", "false", "case_X", "option_x").
    // Mas o canvas xyflow renderiza edges via IDs de Handle reais — pros
    // nós atuais (BaseExecutionNode), os handles são fixos "source-1" e
    // "target-1". Se passarmos a string semântica direto, xyflow não acha
    // o handle e não desenha o edge → "nodes desconectados".
    //
    // Solução conservadora: handles padrão "source-1"/"target-1" são
    // sempre passados pro xyflow (renderização funciona), mas se uma
    // Connection tem fromOutput/toInput diferentes do default vinda
    // do canvas (ex: ConditionalNode futuro com handle "true"), respeitamos.
    //
    // Fase 4 vai adicionar handles nomeados no AgentNode pra que branches
    // (IF/SWITCH/LOOP) apareçam visualmente como saídas separadas.
    // Mapeamento dos handles:
    //  - fromOutput="main" → handle visual "source-1" (legado/default)
    //  - fromOutput nomeado (true/false/loop/done/case_X/branches IA) →
    //    handle visual com mesmo nome (renderizado pelo AgentNode em
    //    posições verticais à direita).
    //  - toInput análogo: "main" → "target-1", senão preserva nome.
    const edges: Edge[] = workflow.connections.map((connection) => ({
      id: connection.id,
      source: connection.fromNodeId,
      target: connection.toNodeId,
      sourceHandle:
        !connection.fromOutput || connection.fromOutput === "main"
          ? "source-1"
          : connection.fromOutput,
      targetHandle:
        !connection.toInput || connection.toInput === "main"
          ? "target-1"
          : connection.toInput,
      data: {
        fromOutput: connection.fromOutput,
        toInput: connection.toInput,
      },
      label:
        connection.fromOutput && connection.fromOutput !== "main"
          ? connection.fromOutput
          : undefined,
    }));

    return {
      workflow,
      nodes,
      edges,
    };
  });
