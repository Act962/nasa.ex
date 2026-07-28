import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import z from "zod";

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
  generateActionsConfig: generateActionsConfigSchema.nullable().optional(),
});

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
  .handler(async ({ input }) => {
    const { id, name, description, jsonBlock, settings } = input;

    // `generateActionsConfig` é um campo Json: sai do spread pra receber o
    // tratamento correto do Prisma (`Prisma.JsonNull` p/ null, cast p/ o resto).
    const { generateActionsConfig, ...restSettings } = settings ?? {};

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
              ...(generateActionsConfig !== undefined && {
                generateActionsConfig:
                  generateActionsConfig === null
                    ? Prisma.JsonNull
                    : (generateActionsConfig as Prisma.InputJsonValue),
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

