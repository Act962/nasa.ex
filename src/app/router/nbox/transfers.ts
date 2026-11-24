import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { NBOX_TRANSFER_MAX_DAYS } from "@/features/nbox/lib/storage-limits";
import { createNboxTransfer, listNboxTransfers, updateNboxTransfer } from "@/features/nbox/server/transfers";
import { toNboxUserMessage } from "@/features/nbox/server/uploads";

// Transferências com prazo (spec 0148, RF-7 e RF-11).

const transferDaysSchema = z.number().int().min(1).max(NBOX_TRANSFER_MAX_DAYS);

export const createTransfer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().max(120).optional(),
      days: transferDaysSchema,
      existingItemIds: z.array(z.string().min(1)).max(100).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await createNboxTransfer({ actor: context.user, organizationId: context.org.id, ...input });
    } catch (error) {
      const message = toNboxUserMessage(error);
      if (message) throw errors.BAD_REQUEST({ message });
      throw error;
    }
  });

export const listTransfers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => ({ transfers: await listNboxTransfers(context.org.id) }));

export const updateTransfer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      transferId: z.string().min(1),
      action: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("extend") }),
        z.object({ kind: z.literal("end") }),
      ]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await updateNboxTransfer({ actor: context.user, organizationId: context.org.id, ...input });
    } catch (error) {
      const message = toNboxUserMessage(error);
      if (message) throw errors.BAD_REQUEST({ message });
      throw error;
    }
  });
