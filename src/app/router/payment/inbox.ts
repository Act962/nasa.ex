import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import {
  ignoreInboxItem,
  listInboxItems,
  loadInboxOverview,
  queueInboxSync,
  updateInboxConfig,
} from "@/features/payment/server/inbox/inbox-service";

// Caixa de entrada Gmail do financeiro (spec 0018). A leitura dos e-mails
// roda no Inngest; aqui ficam configuração, listagem e o disparo manual.

const inboxStatusSchema = z.enum(["NEW", "PROPOSED", "ACCEPTED", "IGNORED", "FAILED"]);

export const getPaymentInboxConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "Get payment inbox config", tags: ["Payment"] })
  .input(z.object({}))
  .handler(async ({ context }) => loadInboxOverview(context.org.id));

export const updatePaymentInboxConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("settings", "edit"))
  .route({ method: "PATCH", summary: "Update payment inbox config", tags: ["Payment"] })
  .input(
    z.object({
      isEnabled: z.boolean().optional(),
      gmailQuery: z.string().max(300).optional(),
      notifyWhatsapp: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const config = await updateInboxConfig({ organizationId: context.org.id, patch: input });
    return { isEnabled: config.isEnabled, gmailQuery: config.gmailQuery, notifyWhatsapp: config.notifyWhatsapp };
  });

export const listPaymentInboxItems = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List payment inbox items", tags: ["Payment"] })
  .input(
    z.object({
      statuses: z.array(inboxStatusSchema).optional(),
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ input, context }) =>
    listInboxItems({
      organizationId: context.org.id,
      statuses: input.statuses,
      page: input.page,
      perPage: input.perPage,
    }),
  );

export const ignorePaymentInboxItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Ignore payment inbox item", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const result = await ignoreInboxItem({ organizationId: context.org.id, itemId: input.id });
    if (!result.ok) {
      if (result.reason === "not_found") throw errors.NOT_FOUND({ message: result.message });
      throw errors.BAD_REQUEST({ message: result.message });
    }
    return { success: true };
  });

export const syncPaymentInboxNow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Sync payment inbox now", tags: ["Payment"] })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    const result = await queueInboxSync({
      organizationId: context.org.id,
      triggeredByUserId: context.user.id,
    });
    if (!result.ok) throw errors.BAD_REQUEST({ message: result.message });
    return { queued: true };
  });
