import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// ── Update profile — name, image (base64) and phone ──────────────────────────
export const updateProfile = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Update user profile" })
  .input(
    z.object({
      name: z.string().trim().min(1).max(120).optional(),
      image: z
        .string()
        .max(7_500_000) // ~5MB after base64 overhead
        .refine(
          (v) => v === "" || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v),
          "Imagem deve estar em base64 (data URL)",
        )
        .optional(),
      phone: z
        .string()
        .trim()
        .max(32)
        .regex(/^\+\d{1,4}\s?\d{6,15}$/, "Use o formato DDI + Telefone, ex: +55 11999999999")
        .optional()
        .or(z.literal("")),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { user } = context;

    const data: { name?: string; image?: string | null; phone?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.image !== undefined) data.image = input.image === "" ? null : input.image;
    if (input.phone !== undefined) data.phone = input.phone === "" ? null : input.phone;

    if (Object.keys(data).length === 0) return { success: true };

    await prisma.user.update({ where: { id: user.id }, data });

    return { success: true };
  });

export const userRouter = { updateProfile };
