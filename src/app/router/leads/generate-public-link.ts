import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import crypto from "node:crypto";

export const generateLeadPublicLink = base
  .use(requiredAuthMiddleware)
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
  .handler(async ({ input, errors }) => {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: input.leadId },
        // publicToken só existe no client após `prisma generate` rodar
        select: { id: true, publicToken: true } as unknown as { id: true; publicToken: true },
      });
      if (!lead) throw errors.NOT_FOUND;

      const existing = (lead as unknown as { publicToken?: string | null }).publicToken;
      let token = existing ?? null;
      if (!token || input.rotate) {
        token = crypto.randomBytes(18).toString("base64url");
        await (prisma.lead.update as (args: unknown) => Promise<unknown>)({
          where: { id: input.leadId },
          data: { publicToken: token },
        });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      return {
        token,
        url: `${baseUrl}/public/lead/${token}`,
      };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
