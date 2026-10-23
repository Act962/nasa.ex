import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { z } from "zod";
import { searchPaymentCustomers } from "@/features/payment/server/customers/search-customers";

// Campo "Cliente" da cobrança: contatos do financeiro e leads do funil numa busca só (spec 0115).
export const searchCustomers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "Search payment contacts and leads", tags: ["Payment"] })
  .input(z.object({ search: z.string().max(120).optional() }))
  .handler(async ({ input, context }) => ({
    customers: await searchPaymentCustomers({
      organizationId: context.org.id,
      userId: context.user.id,
      search: input.search,
    }),
  }));
