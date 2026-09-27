import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  LeadEmailError,
  getLeadEmailThread,
  getOrgGmailStatus,
  listLeadEmailThreads,
  listTrackingLeadsWithEmail,
  sendLeadEmail,
} from "@/features/tracking-chat/server/email/lead-email-service";

/**
 * Canal E-mail do Tracking Chat (spec 0030). Erros do domínio (Gmail não
 * conectado, destinatário fora do tracking) chegam ao usuário com a mensagem
 * e o código, para a tela mostrar o atalho certo.
 */

async function runEmailAction<Result>(action: () => Promise<Result>): Promise<Result> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof LeadEmailError) {
      throw new ORPCError(
        error.code === "gmail_not_connected" || error.code === "gmail_reconnect"
          ? "PRECONDITION_FAILED"
          : "BAD_REQUEST",
        { message: error.message, data: { code: error.code } },
      );
    }
    throw error;
  }
}

const emailProcedure = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

const listThreads = emailProcedure
  .input(z.object({ trackingId: z.string() }))
  .handler(({ context, input }) =>
    runEmailAction(() =>
      listLeadEmailThreads({ organizationId: context.org.id, trackingId: input.trackingId }),
    ),
  );

const getThread = emailProcedure
  .input(z.object({ trackingId: z.string(), threadId: z.string() }))
  .handler(({ context, input }) =>
    runEmailAction(() =>
      getLeadEmailThread({
        organizationId: context.org.id,
        trackingId: input.trackingId,
        threadId: input.threadId,
      }),
    ),
  );

const listLeads = emailProcedure
  .input(z.object({ trackingId: z.string() }))
  .handler(({ context, input }) =>
    runEmailAction(() =>
      listTrackingLeadsWithEmail({
        organizationId: context.org.id,
        trackingId: input.trackingId,
      }),
    ),
  );

const send = emailProcedure
  .input(
    z.object({
      trackingId: z.string(),
      to: z.string().email(),
      subject: z.string().trim().min(1).max(250),
      title: z.string().trim().max(200).optional(),
      body: z.string().trim().min(1).max(20_000),
      threadId: z.string().optional(),
    }),
  )
  .handler(({ context, input }) =>
    runEmailAction(() =>
      sendLeadEmail({ organizationId: context.org.id, ...input }),
    ),
  );

const getStatus = emailProcedure
  .input(z.object({}).optional())
  .handler(({ context }) => getOrgGmailStatus(context.org.id));

export const trackingChatEmailRouter = {
  status: getStatus,
  threads: listThreads,
  thread: getThread,
  leads: listLeads,
  send,
};
