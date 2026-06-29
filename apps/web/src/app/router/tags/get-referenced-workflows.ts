import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Lista todos os workflows ATIVOS que referenciam uma tag específica em
 * algum node `TAG` (action) ou `LEAD_TAGGED` (trigger).
 *
 * Usado pelo dialog de confirmação ao arquivar/editar uma tag — operador
 * vê exatamente quais automações vão ser afetadas antes de confirmar.
 *
 * Implementação: $queryRaw com Postgres JSON operators (?, ->>). Junta
 * `nodes` → `workflows` → `tracking`, filtra por tipo de node + tagId
 * presente em `data->>'tagId'` (single) ou `data->'tagIds'` (array).
 */
export const getReferencedWorkflows = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      tagId: z.string(),
    }),
  )
  .output(
    z.object({
      workflows: z.array(
        z.object({
          workflowId: z.string(),
          name: z.string(),
          trackingId: z.string().nullable(),
          trackingName: z.string().nullable(),
          nodeType: z.enum(["TAG", "LEAD_TAGGED"]),
          isActive: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await prisma.$queryRaw<
      Array<{
        workflow_id: string;
        name: string;
        tracking_id: string | null;
        tracking_name: string | null;
        node_type: "TAG" | "LEAD_TAGGED";
        is_active: boolean;
      }>
    >`
      SELECT DISTINCT
        w.id AS workflow_id,
        w.name,
        w.tracking_id,
        t.name AS tracking_name,
        n.type AS node_type,
        w.is_active
      FROM workflows w
      JOIN nodes n ON n.workflow_id = w.id
      LEFT JOIN tracking t ON t.id = w.tracking_id
      WHERE n.type IN ('TAG', 'LEAD_TAGGED')
        AND (
          (n.data::jsonb->>'tagId') = ${input.tagId}
          OR (n.data::jsonb->'tagIds') ? ${input.tagId}
        )
      ORDER BY w.is_active DESC, w.name ASC
    `;

    return {
      workflows: rows.map((r) => ({
        workflowId: r.workflow_id,
        name: r.name,
        trackingId: r.tracking_id,
        trackingName: r.tracking_name,
        nodeType: r.node_type,
        isActive: r.is_active,
      })),
    };
  });
