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
import {
  captureNewEmailSenders,
  getEmailLeadCapture,
  setEmailLeadCapture,
} from "@/features/tracking-chat/server/email/email-lead-capture";
import prisma from "@/lib/prisma";

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

const getLeadCapture = emailProcedure
  .input(z.object({}).optional())
  .handler(({ context }) => getEmailLeadCapture(context.org.id));

// Spec 0045: liga/desliga "novos remetentes viram lead" neste funil. Ao ligar, já varre a caixa uma vez.
const setLeadCapture = emailProcedure
  .input(z.object({ trackingId: z.string(), isEnabled: z.boolean() }))
  .handler(async ({ context, input }) => {
    const tracking = await prisma.tracking.findFirst({
      where: { id: input.trackingId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!tracking) throw new ORPCError("BAD_REQUEST", { message: "Funil inválido para esta empresa." });
    const current = await getEmailLeadCapture(context.org.id);
    const nextTrackingId = input.isEnabled ? tracking.id : current.trackingId === tracking.id ? null : current.trackingId;
    try {
      await setEmailLeadCapture(context.org.id, nextTrackingId);
    } catch {
      throw new ORPCError("PRECONDITION_FAILED", { message: "Conecte o Gmail da empresa em Integrações primeiro." });
    }
    const capture = input.isEnabled
      ? await captureNewEmailSenders(context.org.id).catch(() => ({ created: 0 }))
      : { created: 0 };
    return { trackingId: nextTrackingId, createdLeads: capture.created };
  });

export const trackingChatEmailRouter = {
  status: getStatus,
  threads: listThreads,
  thread: getThread,
  leads: listLeads,
  send,
  leadCapture: getLeadCapture,
  setLeadCapture,
};
