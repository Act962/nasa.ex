import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createMindMap = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plannerId: z.string(),
      name: z.string().min(1),
      template: z.enum(["mindmap", "gantt", "diagram", "checklist"]).default("mindmap"),
    }),
  )
  .handler(async ({ input, context }) => {
    await prisma.nasaPlanner.findFirstOrThrow({
      where: { id: input.plannerId, organizationId: context.org.id },
    });

    // Seed initial nodes based on template
    const initialNodes = getInitialNodes(input.template, input.name);
    const initialEdges = getInitialEdges(input.template);

    const mindMap = await prisma.nasaPlannerMindMap.create({
      data: {
        plannerId: input.plannerId,
        name: input.name,
        template: input.template,
        nodes: initialNodes as any,
        edges: initialEdges as any,
      },
    });

    return { mindMap };
  });

function getInitialNodes(template: string, name: string) {
  const centerX = 400;
  const centerY = 300;

  if (template === "mindmap") {
    return [
      {
        id: "root",
        type: "mindMapRoot",
        position: { x: centerX, y: centerY },
        data: { label: name, color: "#7C3AED" },
      },
    ];
  }

  if (template === "checklist") {
    return [
      {
        id: "title",
        type: "checklistTitle",
        position: { x: centerX - 150, y: 50 },
        data: { label: name },
      },
      {
        id: "item-1",
        type: "checklistItem",
        position: { x: centerX - 150, y: 130 },
        data: { label: "Tarefa 1", checked: false },
      },
      {
        id: "item-2",
        type: "checklistItem",
        position: { x: centerX - 150, y: 180 },
        data: { label: "Tarefa 2", checked: false },
      },
    ];
  }

  if (template === "gantt") {
    return [
      {
        id: "title",
        type: "ganttTitle",
        position: { x: 50, y: 30 },
        data: { label: name },
      },
      {
        id: "phase-1",
        type: "ganttPhase",
        position: { x: 50, y: 100 },
        data: { label: "Fase 1 - Planejamento", startDay: 1, duration: 7, color: "#7C3AED" },
      },
      {
        id: "phase-2",
        type: "ganttPhase",
        position: { x: 50, y: 160 },
        data: { label: "Fase 2 - Execução", startDay: 8, duration: 14, color: "#EC4899" },
      },
    ];
  }

  if (template === "diagram") {
    return [
      {
        id: "start",
        type: "diagramNode",
        position: { x: centerX, y: 50 },
        data: { label: "Início", shape: "oval", color: "#10B981" },
      },
      {
        id: "step-1",
        type: "diagramNode",
        position: { x: centerX, y: 160 },
        data: { label: "Etapa 1", shape: "rect", color: "#7C3AED" },
      },
      {
        id: "end",
        type: "diagramNode",
        position: { x: centerX, y: 270 },
        data: { label: "Fim", shape: "oval", color: "#EF4444" },
      },
    ];
  }

  return [];
}

function getInitialEdges(template: string) {
  if (template === "diagram") {
    return [
      { id: "e-start-1", source: "start", target: "step-1", type: "smoothstep" },
      { id: "e-1-end", source: "step-1", target: "end", type: "smoothstep" },
    ];
  }
  return [];
}
