import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";

// A aba Contábil mora dentro do financeiro e herda o controle de acesso dele
// (spec 0007): quem não está na whitelist do Payment não vê nada contábil.

export const accountingReadProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"));

export const accountingWriteProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"));

/** Cofre, certificados e pasta restrita: só ADMIN ou OWNER do financeiro. */
export const accountingAdminProcedure = accountingWriteProcedure.use(({ context, next, errors }) => {
  const role = (context as { paymentAccess?: { role?: string } }).paymentAccess?.role;
  if (role !== "ADMIN" && role !== "OWNER") {
    throw errors.FORBIDDEN({ message: "Só administradores do financeiro acessam esta área." });
  }
  return next();
});

export const monthKeySchemaPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
