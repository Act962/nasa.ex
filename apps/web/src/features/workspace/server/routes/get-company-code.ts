import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";

// Generate a unique 6-char alphanumeric code
async function generateUniqueCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = randomBytes(3).toString("hex").toUpperCase(); // e.g. "A3F9B2"
    const existing = await prisma.organization.findUnique({ where: { companyCode: code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error("Não foi possível gerar código único");
}

export const getCompanyCode = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { id: true, companyCode: true, name: true },
    });

    if (!org) throw new Error("Organização não encontrada");

    // Auto-generate if not set
    if (!org.companyCode) {
      const code = await generateUniqueCode();
      const updated = await prisma.organization.update({
        where: { id: org.id },
        data: { companyCode: code },
        select: { companyCode: true, name: true },
      });
      return { companyCode: updated.companyCode!, orgName: updated.name };
    }

    return { companyCode: org.companyCode, orgName: org.name };
  });
