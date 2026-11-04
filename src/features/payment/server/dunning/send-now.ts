import "server-only";

import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { moveIntoBusinessHours } from "./schedule";

// "Enviar cobrança agora": o mesmo disparo da régua (`payment/dunning.fire`) com um registro
// próprio, para sair na hora mesmo que a etapa já tenha saído ou os avisos estejam pausados.

const SENDABLE_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"];
/** Aviso ainda saindo (régua ou manual): um segundo agora mandaria duas mensagens iguais. */
const IN_FLIGHT_WINDOW_MS = 10 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export async function sendDunningStepNow(params: {
  organizationId: string;
  entryId: string;
  stepId: string;
  triggeredByUserId: string;
}): Promise<{ channel: "EMAIL" | "WHATSAPP" | "SMS" }> {
  const [entry, step] = await Promise.all([
    prisma.paymentEntry.findFirst({
      where: { id: params.entryId, organizationId: params.organizationId },
      select: {
        id: true,
        type: true,
        status: true,
        contact: { select: { email: true, phone: true } },
        lead: { select: { email: true, phone: true } },
      },
    }),
    prisma.paymentDunningStep.findFirst({
      where: { id: params.stepId, rule: { organizationId: params.organizationId } },
      select: { id: true, channel: true, enabled: true, rule: { select: { isActive: true } } },
    }),
  ]);
  if (!entry) throw new ORPCError("NOT_FOUND", { message: "Cobrança não encontrada" });
  if (entry.type !== "RECEIVABLE") {
    throw new ORPCError("BAD_REQUEST", { message: "Só dá para cobrar contas a receber" });
  }
  if (!SENDABLE_STATUSES.includes(entry.status)) {
    throw new ORPCError("BAD_REQUEST", { message: "Esta conta não está em aberto" });
  }
  if (!step) throw new ORPCError("NOT_FOUND", { message: "Aviso não encontrado" });
  if (!step.enabled || !step.rule.isActive) {
    throw new ORPCError("BAD_REQUEST", { message: "Este aviso está desligado na régua" });
  }
  if (step.channel === "SMS") {
    throw new ORPCError("BAD_REQUEST", { message: "SMS ainda não é enviado" });
  }

  // Mesma ordem do disparo: contato do financeiro primeiro, depois o lead.
  const hasRecipient =
    step.channel === "EMAIL"
      ? Boolean(entry.contact?.email || entry.lead?.email)
      : Boolean(entry.contact?.phone || entry.lead?.phone);
  if (!hasRecipient) {
    throw new ORPCError("BAD_REQUEST", {
      message: step.channel === "EMAIL" ? "O cliente não tem e-mail cadastrado" : "O cliente não tem telefone cadastrado",
    });
  }

  const now = new Date();
  const sendWindowOpensAt = moveIntoBusinessHours(now);
  if (sendWindowOpensAt.getTime() !== now.getTime()) {
    const opensAtLabel = sendWindowOpensAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    throw new ORPCError("BAD_REQUEST", {
      message: `Fora do horário de cobrança (seg. a sex. das 8h às 20h, sáb. até 12h). Pode enviar a partir de ${opensAtLabel}.`,
    });
  }

  const inFlight = await prisma.paymentDunningExecution.findFirst({
    where: { entryId: entry.id, status: "PENDING", updatedAt: { gte: new Date(now.getTime() - IN_FLIGHT_WINDOW_MS) } },
    select: { id: true },
  });
  if (inFlight) {
    throw new ORPCError("CONFLICT", { message: "Um aviso desta conta está saindo agora. Confira o histórico em instantes." });
  }

  // A chave por minuto faz o índice único barrar dois pedidos simultâneos do mesmo aviso.
  const execution = await prisma.paymentDunningExecution
    .create({
      data: {
        entryId: entry.id,
        stepId: step.id,
        scheduledFor: now,
        status: "PENDING",
        channel: step.channel,
        manualKey: `manual-${Math.floor(now.getTime() / MINUTE_MS)}`,
        manualByUserId: params.triggeredByUserId,
      },
      select: { id: true },
    })
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ORPCError("CONFLICT", { message: "Este aviso acabou de ser enviado. Confira o histórico." });
      }
      throw error;
    });

  try {
    await inngest.send({
      name: "payment/dunning.fire",
      id: `dunning-manual-${execution.id}`,
      data: {
        entryId: entry.id,
        stepId: step.id,
        organizationId: params.organizationId,
        scheduledForMs: now.getTime(),
        manualExecutionId: execution.id,
      },
    });
  } catch (error) {
    await prisma.paymentDunningExecution.update({
      where: { id: execution.id },
      data: { status: "FAILED", executedAt: new Date(), errorMessage: "queue-unavailable" },
    });
    throw error;
  }

  return { channel: step.channel };
}
