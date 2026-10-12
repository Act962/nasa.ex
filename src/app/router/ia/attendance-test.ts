import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { runAttendanceTest } from "@/features/tracking-chat-ai/lib/attendance-test";
import { z } from "zod";

// Teste do atendimento pela tela de configuração (spec 0089). Não envia nada ao WhatsApp.
// O tracking é conferido contra a empresa ativa dentro de `runAttendanceTest`.

export const sendAttendanceTest = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      text: z.string().trim().min(1).max(1500),
      clickId: z.string().max(200).nullable().default(null),
      history: z
        .array(z.object({ role: z.enum(["client", "assistant"]), text: z.string().max(4000) }))
        .max(40)
        .default([]),
    }),
  )
  .handler(async ({ input, context }) =>
    runAttendanceTest({
      organizationId: context.org.id,
      trackingId: input.trackingId,
      userId: context.user.id,
      text: input.text,
      clickId: input.clickId,
      history: input.history,
    }),
  );
