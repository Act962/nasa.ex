import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import crypto from "node:crypto";

export const generateLeadPublicLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Generate or rotate public link token of a lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      rotate: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Só lead da organização ativa: sem este filtro, qualquer usuário logado
    // obtinha (ou trocava) o link público de um lead de outra empresa pelo id.
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, tracking: { organizationId: context.org.id } },
      select: { id: true, publicToken: true },
    });
    if (!lead) throw errors.NOT_FOUND;

    try {
      let token = lead.publicToken ?? null;
      if (!token || input.rotate) {
        token = crypto.randomBytes(18).toString("base64url");
        await prisma.lead.update({
          where: { id: lead.id },
          data: { publicToken: token },
        });
      }

      // O grupo (public) é só organizacional — não aparece na URL final.
      // A rota real é `/lead/[token]/page.tsx` em `src/app/(public)/lead/...`
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      return {
        token,
        url: `${baseUrl}/lead/${token}`,
      };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
