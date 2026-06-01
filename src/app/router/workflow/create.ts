import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      trackingId: z.string(),
      /** Opcional: cria já dentro de uma pasta. */
      folderId: z.string().nullish(),
      /**
       * Opcional: cria já com `agentMode: true`. Usado pelo Cmd+K quando
       * o user escolhe um node do "Modo Agente IA" (WAIT_FOR_EVENT,
       * AI_DECISION, SEND_EMAIL, etc) — esses nodes só funcionam em
       * workflows com agentMode habilitado. Default = false (engine
       * linear legado, compatível com fluxo atual).
       */
      agentMode: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!tracking) {
      throw errors.BAD_REQUEST({
        message: "Tracking não encontrado",
      });
    }

    // Detecta se a feature de pastas tá habilitada (migration aplicada).
    // Quando NÃO está, ignoramos folderId silenciosamente — workflow vira
    // "Sem pasta". Evita erro P2022 / P2021 propagar pro client.
    let foldersEnabled = true;
    if (input.folderId) {
      try {
        const folder = await prisma.workflowFolder.findUnique({
          where: { id: input.folderId },
          select: { trackingId: true },
        });
        if (!folder || folder.trackingId !== input.trackingId) {
          throw errors.BAD_REQUEST({
            message: "Pasta inválida ou de outro tracking",
          });
        }
      } catch (err: unknown) {
        const code =
          err instanceof Error && "code" in err
            ? (err as { code?: string }).code
            : undefined;
        if (code === "P2021" || code === "P2022") {
          foldersEnabled = false;
        } else {
          throw err;
        }
      }
    }

    const workflow = await prisma.workflow
      .create({
        data: {
          name: input.name,
          description: input.description,
          trackingId: input.trackingId,
          userId: context.user.id,
          agentMode: input.agentMode ?? false,
          ...(foldersEnabled ? { folderId: input.folderId ?? null } : {}),
          nodes: {
            create: {
              type: NodeType.INITIAL,
              position: { x: 0, y: 0 },
              name: NodeType.INITIAL,
            },
          },
        },
      })
      .catch(async (err: unknown) => {
        const code =
          err instanceof Error && "code" in err
            ? (err as { code?: string }).code
            : undefined;
        // Coluna folder_id não existe ainda → retry sem ela
        if (code === "P2022") {
          return prisma.workflow.create({
            data: {
              name: input.name,
              description: input.description,
              trackingId: input.trackingId,
              userId: context.user.id,
              agentMode: input.agentMode ?? false,
              nodes: {
                create: {
                  type: NodeType.INITIAL,
                  position: { x: 0, y: 0 },
                  name: NodeType.INITIAL,
                },
              },
            },
          });
        }
        throw err;
      });

    await logActivity({
      organizationId: tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      action: "workflow.created",
      actionLabel: `Criou o workflow "${workflow.name}" no tracking "${tracking.name}"`,
      resource: workflow.name,
      resourceId: workflow.id,
      metadata: { trackingName: tracking.name },
    });

    return {
      id: workflow.id,
      trackingId: workflow.trackingId,
      trackingName: workflow.name,
    };
  });
