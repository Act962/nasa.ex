import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import z from "zod";
import { isFormPolicyManager } from "@/features/form/lib/can-edit-response";

const titleTokenSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("field"), blockId: z.string() }),
  z.object({ type: z.literal("literal"), text: z.string() }),
]);

const dueDatePresetSchema = z.discriminatedUnion("preset", [
  z.object({ preset: z.literal("today") }),
  z.object({ preset: z.literal("tomorrow") }),
  z.object({ preset: z.literal("in_days"), days: z.number().int().min(0).max(365) }),
  z.object({ preset: z.literal("end_of_week") }),
]);

const actionTemplateSchema = z.object({
  title: z.array(titleTokenSchema).default([]),
  workspaceId: z.string().nullable().default(null),
  columnId: z.string().nullable().default(null),
  coverImage: z
    .object({ blockId: z.string(), index: z.number().int().min(0).default(0) })
    .nullable()
    .default(null),
  dueDate: dueDatePresetSchema.nullable().default(null),
  /** Formulários extras na pauta da action gerada — ver spec 0002, D-2. */
  attachFormIds: z.array(z.string()).max(20).default([]),
});

const generateActionsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  template: actionTemplateSchema.nullable().default(null),
});

const settingsSchema = z.object({
  primaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().nullable().optional(),
  trackingId: z.string().nullable().optional(),
  statusId: z.string().nullable().optional(),
  showName: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  needLogin: z.boolean().optional(),
  finishMessage: z.string().optional(),
  redirectUrl: z.string().nullable().optional(),
  idPixel: z.string().nullable().optional(),
  idTagManager: z.string().nullable().optional(),
  stepMode: z.string().optional(),
  nextButtonLabel: z.string().optional(),
  progressMascots: z
    .array(
      z.object({
        min: z.number(),
        max: z.number(),
        label: z.string(),
        emoji: z.string().optional(),
        imageUrl: z.string().optional(),
      }),
    )
    .optional(),
  nextButtonAction: z
    .object({
      type: z.enum(["next_block", "form", "external_link", "add_tag"]),
      formId: z.string().optional().nullable(),
      externalUrl: z.string().optional().nullable(),
      tagId: z.string().optional().nullable(),
      passLeadData: z.boolean().optional(),
    })
    .optional(),
  whatsappChats: z
    .array(z.object({ chatId: z.string(), chatName: z.string() }))
    .optional(),
  whatsappMessage: z.string().optional().nullable(),
  validateWhatsapp: z.boolean().optional(),
  resumeSession: z.boolean().optional(),
  generateActionsConfig: generateActionsConfigSchema.nullable().optional(),
  /** Spec 0005 — alterar exige ser gestor (D-13). */
  responseEditPolicy: z
    .enum(["TRACKING_PARTICIPANTS", "AUTHOR_ONLY"])
    .optional(),
});

type GenerateActionsConfigInput = z.infer<typeof generateActionsConfigSchema>;

/**
 * Descarta ids de `attachFormIds` que não sejam de formulários da mesma
 * organização do form editado — a pauta não pode cruzar tenants (spec 0002, I3).
 */
async function sanitizeAttachFormIds(
  formId: string,
  config: GenerateActionsConfigInput,
): Promise<GenerateActionsConfigInput> {
  const template = config.template;
  if (!template || template.attachFormIds.length === 0) return config;

  const editedForm = await prisma.form.findUnique({
    where: { id: formId },
    select: { organizationId: true },
  });
  if (!editedForm) return config;

  const sameOrgForms = await prisma.form.findMany({
    where: {
      id: { in: template.attachFormIds },
      organizationId: editedForm.organizationId,
    },
    select: { id: true },
  });
  const allowedIds = new Set(sameOrgForms.map((candidate) => candidate.id));

  return {
    ...config,
    template: {
      ...template,
      attachFormIds: template.attachFormIds.filter((attachId) =>
        allowedIds.has(attachId),
      ),
    },
  };
}

export const updateForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/:id",
    summary: "Save (update) form content and metadata",
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      jsonBlock: z.string(),
      settings: settingsSchema.optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, name, description, jsonBlock, settings } = input;
    const userId = context.user.id;

    // Antes da spec 0005 este handler não recebia `context`: qualquer usuário
    // autenticado reescrevia qualquer formulário de qualquer organização
    // (escrita cross-tenant). RF-0.
    const existingForm = await prisma.form.findUnique({
      where: { id },
      select: {
        organizationId: true,
        settings: { select: { trackingId: true } },
      },
    });
    if (!existingForm) {
      throw errors.NOT_FOUND({ message: "Formulário não encontrado" });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: existingForm.organizationId, userId },
      select: { role: true },
    });
    if (!member) {
      throw errors.UNAUTHORIZED({
        message: "Você não tem acesso a este formulário",
      });
    }

    // A política de edição de respostas vale o que valer a procedure que a
    // escreve: sem este gate, quem for bloqueado por `AUTHOR_ONLY` afrouxaria
    // o próprio bloqueio numa chamada (spec 0005, D-13).
    if (settings?.responseEditPolicy !== undefined) {
      const isPolicyManager = await isFormPolicyManager({
        userId,
        organizationId: existingForm.organizationId,
        formTrackingId: existingForm.settings?.trackingId ?? null,
      });
      if (!isPolicyManager) {
        throw errors.FORBIDDEN({
          message:
            "Apenas o Master da conta ou o Owner do tracking podem alterar quem edita as respostas.",
        });
      }
    }

    // `generateActionsConfig` é um campo Json: sai do spread pra receber o
    // tratamento correto do Prisma (`Prisma.JsonNull` p/ null, cast p/ o resto).
    const { generateActionsConfig, ...restSettings } = settings ?? {};

    const sanitizedActionsConfig = generateActionsConfig
      ? await sanitizeAttachFormIds(id, generateActionsConfig)
      : generateActionsConfig;

    const form = await prisma.form.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        jsonBlock: jsonBlock as any,
        ...(settings && {
          settings: {
            update: {
              ...restSettings,
              ...(sanitizedActionsConfig !== undefined && {
                generateActionsConfig:
                  sanitizedActionsConfig === null
                    ? Prisma.JsonNull
                    : (sanitizedActionsConfig as Prisma.InputJsonValue),
              }),
            },
          },
        }),
      },
      include: {
        settings: true,
      },
    });

    return {
      message: "Formulário atualizado com sucesso",
      form,
    };
  });

