import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/** Grava no Histórico as falas de uma chamada de voz que não passaram pelo chat de texto (spec 0054, RF-4). */

const MAX_TURNS_PER_CALL = 60;

export const appendAstroVoiceTurns = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/astro/sessions/append-voice-turns", summary: "Append voice call transcripts to an ASTRO session" })
  .input(
    z.object({
      sessionId: z.string(),
      turns: z
        .array(
          z.object({
            id: z.string().min(1).max(80),
            role: z.enum(["user", "assistant"]),
            text: z.string().min(1).max(4000),
          }),
        )
        .min(1)
        .max(MAX_TURNS_PER_CALL),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const session = await prisma.aiSession.findUnique({
      where: { id: input.sessionId },
      select: { userId: true, organizationId: true, messages: true },
    });
    if (!session || session.userId !== context.user.id || session.organizationId !== organizationId) {
      throw errors.NOT_FOUND();
    }

    const storedMessages = Array.isArray(session.messages) ? (session.messages as Array<{ id?: string }>) : [];
    const storedIds = new Set(storedMessages.map((message) => message.id));
    const newMessages = input.turns
      .filter((turn) => !storedIds.has(turn.id))
      .map((turn) => ({ id: turn.id, role: turn.role, parts: [{ type: "text", text: turn.text }] }));
    if (newMessages.length === 0) return { appended: 0 };

    await prisma.aiSession.update({
      where: { id: input.sessionId },
      data: { messages: [...storedMessages, ...newMessages] as unknown as object },
    });
    return { appended: newMessages.length };
  });
