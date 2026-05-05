import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { checkBalance } from "@/features/stars/lib/star-service";
import { PAGES_STARS_COST } from "./_schemas";

export const getPagesCost = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/cost",
    summary: "Obter custo em Stars da criação/duplicação de uma página NASA",
  })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const bal = await checkBalance(organizationId);
    return {
      stars: PAGES_STARS_COST,
      balance: bal.balance,
      canAfford: bal.balance >= PAGES_STARS_COST,
    };
  });
