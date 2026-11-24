import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 30;

/** Recibo = venda registrada pelo "Registrar venda" ou pelo chat: só ela grava a forma de pagamento (spec 0148). */
export const SALE_RECEIPT_WHERE = { status: "PAGA", paymentMethod: { not: null } } satisfies Prisma.ForgeProposalWhereInput;

const receiptShape = z.object({
  id: z.string(),
  number: z.number(),
  publicToken: z.string(),
  clientName: z.string().nullable(),
  clientPhone: z.string().nullable(),
  total: z.number(),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "BOLETO"]).nullable(),
  installments: z.number().nullable(),
  paidAt: z.date().nullable(),
  responsibleName: z.string().nullable(),
});

/** "Meus recibos" (spec 0151, RF-13): todos os recibos da empresa, do mais novo para o mais antigo. */
export const listSaleReceipts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List issued sale receipts", tags: ["Forge"] })
  .input(z.object({ search: z.string().trim().max(120).optional(), page: z.number().int().min(1).default(1) }))
  .output(z.object({ receipts: z.array(receiptShape), total: z.number(), hasMore: z.boolean() }))
  .handler(async ({ input, context }) => {
    const search = input.search;
    const searchNumber = search && /^\d+$/.test(search) ? Number(search) : null;
    const where: Prisma.ForgeProposalWhereInput = {
      organizationId: context.org.id,
      ...SALE_RECEIPT_WHERE,
      ...(search
        ? {
            OR: [
              { client: { name: { contains: search, mode: "insensitive" } } },
              { client: { phone: { contains: search.replace(/\D/g, "") || search } } },
              ...(searchNumber ? [{ number: searchNumber }] : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.forgeProposal.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { number: "desc" }],
        skip: (input.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          number: true,
          publicToken: true,
          paymentMethod: true,
          installments: true,
          paidAt: true,
          client: { select: { name: true, phone: true } },
          responsible: { select: { name: true } },
          products: { select: { quantity: true, unitValue: true, discount: true } },
        },
      }),
      prisma.forgeProposal.count({ where }),
    ]);

    return {
      receipts: rows.map((row) => ({
        id: row.id,
        number: row.number,
        publicToken: row.publicToken,
        clientName: row.client?.name ?? null,
        clientPhone: row.client?.phone ?? null,
        total: row.products.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitValue) - Number(line.discount ?? 0), 0),
        paymentMethod: row.paymentMethod,
        installments: row.installments,
        paidAt: row.paidAt,
        responsibleName: row.responsible?.name ?? null,
      })),
      total,
      hasMore: input.page * PAGE_SIZE < total,
    };
  });
