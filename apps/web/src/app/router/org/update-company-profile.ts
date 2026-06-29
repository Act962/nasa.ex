import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { COMPANY_TYPE_SLUGS } from "@/features/company/constants";

const ALLOWED_ROLES = ["owner", "admin", "moderador"];

const cnpjRegex = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})$/;

export const updateCompanyProfile = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      companyType: z
        .string()
        .refine((v) => v === "" || COMPANY_TYPE_SLUGS.includes(v), {
          message: "Tipo de empresa inválido",
        })
        .optional(),
      companySegment: z.string().max(120).optional().nullable(),
      cnpj: z
        .string()
        .nullable()
        .optional()
        .refine((v) => v == null || v === "" || cnpjRegex.test(v), {
          message: "CNPJ inválido (use 00.000.000/0001-00 ou apenas dígitos)",
        }),
      contactEmail: z
        .string()
        .nullable()
        .optional()
        .refine(
          (v) => v == null || v === "" || z.string().email().safeParse(v).success,
          { message: "E-mail inválido" },
        ),
      contactPhone: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!member || !ALLOWED_ROLES.includes(member.role)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/admin podem editar dados da empresa",
      });
    }

    const data: Record<string, unknown> = {};
    if (input.companyType !== undefined) data.companyType = input.companyType || null;
    if (input.companySegment !== undefined) data.companySegment = input.companySegment ?? null;
    if (input.cnpj !== undefined) data.cnpj = input.cnpj || null;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail || null;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone || null;

    const org = await prisma.organization.update({
      where: { id: context.org.id },
      data,
      select: {
        id: true,
        name: true,
        companyType: true,
        companySegment: true,
        cnpj: true,
        contactEmail: true,
        contactPhone: true,
      },
    });
    return { org };
  });
