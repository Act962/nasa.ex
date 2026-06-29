import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Lista workflows que referenciam um Status específico em algum node.
 * Status aparece em:
 *  - `MOVE_LEAD` action — node.data.statusId
 *  - `MOVE_LEAD_STATUS` trigger — node.data.statusId
 *  - `FILTER_LEAD` action — node.data.conditions[].value pode conter statusId
 *    (mais complexo; cobrimos por extensão futura)
 *
 * Usado pelo dialog de confirmação antes de deletar um status — operador vê
 * exatamente quais automações vão quebrar.
 */
export const getStatusReferencedWorkflows = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      statusId: z.string(),
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
          nodeType: z.string(),
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
        node_type: string;
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
      WHERE n.type IN ('MOVE_LEAD', 'MOVE_LEAD_STATUS')
        AND (n.data::jsonb->>'statusId') = ${input.statusId}
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
