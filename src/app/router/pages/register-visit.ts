import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const registerPageVisit = base
  .route({
    method: "POST",
    path: "/public/pages/:slug/visit",
    summary: "Registrar visita pública (analytics)",
  })
  .input(
    z.object({
      slug: z.string(),
      path: z.string().optional(),
      referrer: z.string().optional(),
      userAgent: z.string().optional(),
      country: z.string().optional(),
      device: z.enum(["desktop", "tablet", "mobile"]).optional(),
      // Convenção pra registrar eventos sem migration: o tracker
      // client-side envia "event" + "targetId" + "value" e o
      // handler grava tudo no campo `path` como string estruturada
      // `_evt:<type>:<targetId>:<value>`. Agregação depois faz
      // parsing simples — substring/group-by.
      //
      // Tipos esperados:
      //   - "click"   : user clicou num element (targetId = el id)
      //   - "scroll"  : marker de scroll depth (value = 25/50/75/100)
      //   - "section" : section entrou em viewport (targetId = el id)
      //   - "dwell"   : tempo gasto na página (value = segundos)
      event: z.enum(["click", "scroll", "section", "dwell"]).optional(),
      targetId: z.string().optional(),
      value: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const page = await prisma.nasaPage.findFirst({
      where: { slug: input.slug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!page) return { success: false };

    // Se evento, comprime em `path` com convenção (evita migration).
    const path = input.event
      ? `_evt:${input.event}:${input.targetId ?? ""}:${input.value ?? ""}`
      : input.path;

    await prisma.nasaPageVisit.create({
      data: {
        pageId: page.id,
        path,
        referrer: input.referrer,
        userAgent: input.userAgent,
        country: input.country,
        device: input.device,
      },
    });
    return { success: true };
  });
