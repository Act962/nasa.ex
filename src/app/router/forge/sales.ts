import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { createLeadRecord } from "@/features/leads/server/lead-commands";
import { findSaleClientByPhone } from "@/features/forge/server/sale/find-sale-client";
import { runProposalPaidEffects } from "@/features/forge/server/proposal-paid-effects";

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const MAX_INSTALLMENTS = 24;
const MAX_NUMBER_ATTEMPTS = 3;

const saleClientShape = z.object({
  id: z.string(),
  name: z.string(),
  document: z.string().nullable(),
  trackingName: z.string(),
  hasConversation: z.boolean(),
});

const addressShape = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

const filledOrUndefined = (value?: string) => (value && value.trim() !== "" ? value.trim() : undefined);

export const lookupSaleClient = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Find the lead of a sale by phone", tags: ["Forge"] })
  .input(z.object({ phone: z.string().min(8) }))
  .output(z.object({ isPhoneValid: z.boolean(), client: saleClientShape.nullable() }))
  .handler(async ({ input, context }) => {
    const { normalizedPhone, lead } = await findSaleClientByPhone(context.org.id, input.phone);
    return {
      isPhoneValid: Boolean(normalizedPhone),
      client: lead
        ? {
            id: lead.id,
            name: lead.name,
            document: lead.document,
            trackingName: lead.tracking.name,
            hasConversation: Boolean(lead.conversation),
          }
        : null,
    };
  });

export const registerSale = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Register a paid sale and issue its receipt", tags: ["Forge"] })
  .input(
    z.object({
      phone: z.string().min(8),
      name: z.string().optional(),
      trackingId: z.string().optional(),
      document: z.string().optional(),
      address: addressShape.optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().min(1),
            unitValue: z.number().min(0),
            discountPerUnit: z.number().min(0).default(0),
          }),
        )
        .min(1),
      paymentMethod: z.enum(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "BOLETO"]),
      installments: z.number().int().min(1).max(MAX_INSTALLMENTS).optional(),
    }),
  )
  .output(z.object({ proposalId: z.string(), number: z.number(), publicToken: z.string(), leadId: z.string(), isDuplicate: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (input.items.some((item) => item.discountPerUnit > item.unitValue)) {
      throw errors.BAD_REQUEST({ message: "O desconto não pode ser maior que o preço." });
    }

    const products = await prisma.forgeProduct.findMany({
      where: { id: { in: input.items.map((item) => item.productId) }, organizationId },
      select: { id: true, name: true },
    });
    if (products.length !== new Set(input.items.map((item) => item.productId)).size) {
      throw errors.BAD_REQUEST({ message: "Produto não encontrado." });
    }

    const { normalizedPhone, lead: existingLead } = await findSaleClientByPhone(organizationId, input.phone);
    if (!normalizedPhone) throw errors.BAD_REQUEST({ message: "Número de telefone inválido." });

    let leadId = existingLead?.id;
    let leadName = existingLead?.name;
    if (!leadId) {
      const name = filledOrUndefined(input.name);
      if (!name || !input.trackingId) throw errors.BAD_REQUEST({ message: "Cliente novo: informe o nome e o funil." });
      const firstStatus = await prisma.status.findFirst({
        where: { trackingId: input.trackingId, tracking: { organizationId, participants: { some: { userId: context.user.id } } } },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (!firstStatus) throw errors.BAD_REQUEST({ message: "Funil não encontrado." });
      const { lead } = await createLeadRecord({
        actor: { id: context.user.id, name: context.user.name, email: context.user.email, image: (context.user as { image?: string | null }).image ?? null },
        via: "Registrar venda",
        input: { name, phone: normalizedPhone, statusId: firstStatus.id, trackingId: input.trackingId },
      });
      leadId = lead.id;
      leadName = lead.name;
    }

    const leadUpdate = {
      document: filledOrUndefined(input.document),
      addressStreet: filledOrUndefined(input.address?.street),
      addressNumber: filledOrUndefined(input.address?.number),
      addressComplement: filledOrUndefined(input.address?.complement),
      addressNeighborhood: filledOrUndefined(input.address?.neighborhood),
      addressCity: filledOrUndefined(input.address?.city),
      addressState: filledOrUndefined(input.address?.state),
      addressZipCode: filledOrUndefined(input.address?.zipCode),
    };
    if (Object.values(leadUpdate).some(Boolean)) {
      await prisma.lead.update({ where: { id: leadId }, data: leadUpdate });
    }

    const total = input.items.reduce((sum, item) => sum + item.quantity * (item.unitValue - item.discountPerUnit), 0);
    const installments = input.paymentMethod === "CREDITO" ? (input.installments ?? 1) : null;

    const findRecentDuplicate = async () => {
      const recentSales = await prisma.forgeProposal.findMany({
        where: {
          organizationId,
          clientId: leadId,
          responsibleId: context.user.id,
          status: "PAGA",
          paidAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
        select: { id: true, number: true, publicToken: true, products: { select: { quantity: true, unitValue: true, discount: true } } },
      });
      return recentSales.find((sale) => {
        const saleTotal = sale.products.reduce(
          (sum, line) => sum + Number(line.quantity) * Number(line.unitValue) - Number(line.discount ?? 0),
          0,
        );
        return Math.abs(saleTotal - total) < 0.01;
      });
    };
    const duplicateResult = (duplicate: { id: string; number: number; publicToken: string }) => ({
      proposalId: duplicate.id,
      number: duplicate.number,
      publicToken: duplicate.publicToken,
      leadId,
      isDuplicate: true,
    });

    const duplicate = await findRecentDuplicate();
    if (duplicate) return duplicateResult(duplicate);

    const productNameById = new Map(products.map((product) => [product.id, product.name]));
    const firstProductName = productNameById.get(input.items[0].productId) ?? "Venda";
    const paidAt = new Date();

    // Duas vendas ao mesmo tempo podem pegar o mesmo número: a segunda refaz a conta (ou, se for o
    // mesmo clique repetido, devolve a venda que acabou de entrar).
    const createSale = () => prisma.$transaction(async (tx) => {
      const last = await tx.forgeProposal.findFirst({
        where: { organizationId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      return tx.forgeProposal.create({
        data: {
          organizationId,
          title: `Venda – ${firstProductName} – ${leadName}`,
          number: (last?.number ?? 0) + 1,
          status: "PAGA",
          paidAt,
          paymentMethod: input.paymentMethod,
          installments,
          clientId: leadId,
          responsibleId: context.user.id,
          participants: [],
          createdById: context.user.id,
          products: {
            create: input.items.map((item, index) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitValue: item.unitValue,
              discount: item.discountPerUnit > 0 ? item.discountPerUnit * item.quantity : null,
              order: index,
            })),
          },
        },
        select: { id: true, number: true, publicToken: true, orgProjectId: true },
      });
    });
    const isNumberTaken = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

    let proposal: Awaited<ReturnType<typeof createSale>> | null = null;
    for (let attempt = 1; !proposal; attempt++) {
      try {
        proposal = await createSale();
      } catch (error) {
        if (!isNumberTaken(error) || attempt >= MAX_NUMBER_ATTEMPTS) throw error;
        const concurrent = await findRecentDuplicate();
        if (concurrent) return duplicateResult(concurrent);
      }
    }
    if (!proposal) throw new Error("Venda não registrada.");

    // A venda já está gravada: falha daqui em diante não pode virar erro na tela, senão o vendedor
    // tenta de novo e registra outra venda (Regra 18: efeitos depois do commit, best-effort).
    try {
      await chargeStarsByAction(organizationId, "forge_proposal_create", {
        userId: context.user.id,
        description: `Registrou venda para "${leadName}"`,
        appSlug: "forge",
      });
      await eventBus.publish("forge.proposal_status_changed", {
        proposalId: proposal.id,
        fromStatus: "RASCUNHO",
        toStatus: "PAGA",
        orgId: organizationId,
        leadId,
        responsibleId: context.user.id,
        amount: total,
      });
      await runProposalPaidEffects(
        { id: proposal.id, organizationId, clientId: leadId, responsibleId: context.user.id, orgProjectId: proposal.orgProjectId },
        { withOnboarding: false },
      );
    } catch (error) {
      console.error("[forge/sales] efeitos depois da venda falharam", { proposalId: proposal.id, error });
    }

    return { proposalId: proposal.id, number: proposal.number, publicToken: proposal.publicToken, leadId, isDuplicate: false };
  });
