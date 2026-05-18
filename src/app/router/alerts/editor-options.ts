import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista as entidades referenciáveis nos parâmetros de AlertRule.
 *
 * Usado pelo `<ParamForm>` dentro do `RuleEditDialog` da página
 * /settings/notifications aba Automações. Em vez de o user digitar
 * `{"statusId": "cm123..."}`, ele escolhe Tracking → Status num picker.
 *
 * Retorna em UMA call:
 *   - Trackings + seus statuses + tags (relação 1:N).
 *   - Agendas da org.
 *   - Forms da org.
 *   - Workspaces da org.
 *
 * Cada lista é cap em ~50 itens (orgs grandes raramente têm mais).
 */
export const listEditorOptions = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/alerts/editor-options",
    summary: "Lista entidades referenciáveis em params de AlertRule",
  })
  .input(z.object({}).optional())
  .output(
    z.object({
      trackings: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          statuses: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              color: z.string().nullable(),
            }),
          ),
        }),
      ),
      tags: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().nullable(),
          trackingId: z.string().nullable(),
        }),
      ),
      agendas: z.array(
        z.object({ id: z.string(), name: z.string(), slug: z.string() }),
      ),
      forms: z.array(z.object({ id: z.string(), name: z.string() })),
      workspaces: z.array(
        z.object({ id: z.string(), name: z.string() }),
      ),
    }),
  )
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const [trackings, tags, agendas, forms, workspaces] = await Promise.all([
      prisma.tracking.findMany({
        where: { organizationId, isArchived: false },
        select: {
          id: true,
          name: true,
          status: {
            select: { id: true, name: true, color: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.tag.findMany({
        where: { organizationId },
        select: { id: true, name: true, color: true, trackingId: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      prisma.agenda.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.form.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.workspace.findMany({
        where: { organizationId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
    ]);

    return {
      trackings: trackings.map((t) => ({
        id: t.id,
        name: t.name,
        statuses: t.status,
      })),
      tags,
      agendas,
      forms,
      workspaces,
    };
  });
