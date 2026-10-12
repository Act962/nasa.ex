import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { PLACEHOLDER_PROBLEM, hasPlaceholderText } from "@/features/workflows/lib/placeholder-text";
import prisma from "@/lib/prisma";
import { canAccessMenu } from "./button-preset-access";
import z from "zod";

const buttonSchema = z.object({
  text: z.string(),
  id: z.string(),
  // tagId opcional: ao clicar no botão, o webhook aplica esta tag ao lead
  // (buttonTagMap = buttonId→tagId). Mesma semântica do modo inline.
  tagId: z.string().optional(),
});

export const updateAiButtonPreset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      bodyText: z.string().optional(),
      footerText: z.string().optional().nullable(),
      buttons: z.array(buttonSchema).optional(),
      menuFormat: z.enum(["BUTTON", "LIST"]).optional(),
      listButton: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...rest } = input;
    if (!(await canAccessMenu(id, context.user.id))) {
      throw errors.NOT_FOUND({ message: "Preset de botões não encontrado" });
    }

    const data: Record<string, unknown> = {};
    if (rest.name !== undefined) data.name = rest.name;
    if (rest.description !== undefined) data.description = rest.description;
    if (rest.bodyText !== undefined) data.bodyText = rest.bodyText;
    if (rest.footerText !== undefined) data.footerText = rest.footerText;
    if (rest.buttons !== undefined) data.buttons = rest.buttons;
    if (rest.menuFormat !== undefined) data.menuFormat = rest.menuFormat;
    if (rest.listButton !== undefined) data.listButton = rest.listButton;
    if (rest.isActive !== undefined) data.isActive = rest.isActive;

    // Menu com texto de exemplo do modelo de atendimento não liga (spec 0097).
    if (rest.isActive === true) {
      const current = await prisma.aiButtonPreset.findUnique({ where: { id }, select: { bodyText: true, buttons: true } });
      if (hasPlaceholderText([rest.bodyText ?? current?.bodyText, rest.buttons ?? current?.buttons])) {
        throw errors.BAD_REQUEST({ message: `${PLACEHOLDER_PROBLEM.title}: ${PLACEHOLDER_PROBLEM.message}` });
      }
    }

    try {
      const preset = await prisma.aiButtonPreset.update({
        where: { id },
        data,
      });

      return { preset };
    } catch {
      throw errors.NOT_FOUND({
        message: "Preset de botões não encontrado",
      });
    }
  });
