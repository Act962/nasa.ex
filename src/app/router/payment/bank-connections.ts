import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { isOrgOwnerOrAdmin } from "@/features/permissions/server/is-org-admin";
import {
  disconnectBankConnection,
  saveBankConnection,
  setChargeConnection,
  testBankConnection,
  type BankConnectionResult,
} from "@/features/payment/server/bank-charges/connection-service";
import { z } from "zod";

// Conexão da conta bancária com a API do banco (spec 0130, RF-1, RF-3, RF-10). Só dono ou
// administrador: a credencial dá acesso à conta da empresa (RNF-3).

const PEM_MAX_LENGTH = 20_000;
const OWNER_ONLY_MESSAGE = "Só o dono ou um administrador da empresa pode mexer na conexão com o banco.";

export const bankConnectionShape = z.object({
  id: z.string(),
  provider: z.enum(["INTER"]),
  environment: z.enum(["production", "sandbox"]),
  clientIdLast4: z.string(),
  certificateValidTo: z.date().nullable(),
  scopes: z.array(z.string()),
  moneyMovingScopes: z.array(z.string()),
  pixKey: z.string(),
  accountNumber: z.string().nullable(),
  isDefaultForCharges: z.boolean(),
  webhookRegisteredAt: z.date().nullable(),
  lastErrorMessage: z.string().nullable(),
  lastErrorAt: z.date().nullable(),
  connectedAt: z.date(),
  status: z.enum(["ACTIVE", "CERTIFICATE_EXPIRED", "WEBHOOK_PENDING", "ERROR"]),
});

const ownerOrAdminProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("accounts", "edit"))
  .use(async ({ context, next, errors }) => {
    if (!(await isOrgOwnerOrAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({ message: OWNER_ONLY_MESSAGE });
    }
    return next();
  });

function unwrapConnection(
  result: BankConnectionResult,
  errors: { NOT_FOUND: (options: { message: string }) => Error; BAD_REQUEST: (options: { message: string }) => Error },
) {
  if (result.ok) return { connection: result.connection };
  if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
  throw errors.BAD_REQUEST({ message: result.message });
}

function toActor(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}

export const saveBankConnectionProcedure = ownerOrAdminProcedure
  .route({ method: "POST", summary: "Connect a bank account to the bank API", tags: ["Payment"] })
  .input(
    z.object({
      accountId: z.string(),
      provider: z.enum(["INTER"]),
      environment: z.enum(["production", "sandbox"]),
      clientId: z.string().trim().max(200).optional(),
      clientSecret: z.string().trim().max(500).optional(),
      certificatePem: z.string().max(PEM_MAX_LENGTH).optional(),
      privateKeyPem: z.string().max(PEM_MAX_LENGTH).optional(),
      pixKey: z.string().trim().min(1, "Informe a chave PIX da conta").max(140),
      accountNumber: z.string().trim().max(30).nullable().optional(),
    }),
  )
  .output(z.object({ connection: bankConnectionShape }))
  .handler(async ({ input, context, errors }) =>
    unwrapConnection(
      await saveBankConnection({ organizationId: context.org.id, actor: toActor(context.user), input }),
      errors,
    ),
  );

export const testBankConnectionProcedure = ownerOrAdminProcedure
  .route({ method: "POST", summary: "Test a bank API connection", tags: ["Payment"] })
  .input(z.object({ connectionId: z.string() }))
  .output(z.object({ connection: bankConnectionShape }))
  .handler(async ({ input, context, errors }) =>
    unwrapConnection(
      await testBankConnection({ organizationId: context.org.id, connectionId: input.connectionId }),
      errors,
    ),
  );

export const setChargeConnectionProcedure = ownerOrAdminProcedure
  .route({ method: "POST", summary: "Choose the bank connection that issues charge PIX", tags: ["Payment"] })
  .input(z.object({ connectionId: z.string(), isDefaultForCharges: z.boolean() }))
  .output(z.object({ connection: bankConnectionShape }))
  .handler(async ({ input, context, errors }) =>
    unwrapConnection(
      await setChargeConnection({
        organizationId: context.org.id,
        actor: toActor(context.user),
        connectionId: input.connectionId,
        isDefaultForCharges: input.isDefaultForCharges,
      }),
      errors,
    ),
  );

export const disconnectBankConnectionProcedure = ownerOrAdminProcedure
  .route({ method: "POST", summary: "Disconnect a bank API connection", tags: ["Payment"] })
  .input(z.object({ connectionId: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const result = await disconnectBankConnection({
      organizationId: context.org.id,
      actor: toActor(context.user),
      connectionId: input.connectionId,
    });
    if (!result.ok) throw errors.NOT_FOUND({ message: result.message });
    return { ok: true };
  });
