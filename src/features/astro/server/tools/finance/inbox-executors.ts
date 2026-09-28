import "server-only";
import {
  registerProposalExecutor,
  type ProposalExecutionResult,
} from "@/features/astro/server/tools/_shared/proposals/types";
import { ignoreInboxItem } from "@/features/payment/server/inbox/inbox-service";
import { assertPaymentToolAccess } from "./access";

// Executor da proposta de ignorar item da caixa de entrada Gmail (spec 0018).

export const INBOX_ACTION_TYPES = {
  ignoreItem: "payment.inbox.ignore",
} as const;

export interface IgnoreInboxItemProposalPayload {
  itemId: string;
}

registerProposalExecutor<IgnoreInboxItemProposalPayload>(
  INBOX_ACTION_TYPES.ignoreItem,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    const result = await ignoreInboxItem({ organizationId: ctx.organizationId, itemId: payload.itemId });
    if (!result.ok) return { ok: false, summary: result.message };

    return {
      ok: true,
      summary: `Documento do e-mail "${result.subject}" marcado como ignorado.`,
      links: [{ label: "Abrir Documentos", href: "/payment?tab=documents" }],
      data: { itemId: payload.itemId },
    };
  },
);
