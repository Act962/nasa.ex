import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { NerpHttpError } from "@/http/nerp/types";

export async function markNerpSuccess(integrationId: string): Promise<void> {
  await prisma.platformIntegration
    .update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    })
    .catch(() => {});
}

export async function markNerpError(
  integrationId: string,
  err: unknown,
): Promise<void> {
  const message =
    err instanceof NerpHttpError
      ? `[${err.status}${err.code ? ` ${err.code}` : ""}] ${err.message}`
      : err instanceof Error
        ? err.message
        : "Erro desconhecido na integração nerp";

  await prisma.platformIntegration
    .update({
      where: { id: integrationId },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: message.slice(0, 500),
      },
    })
    .catch(() => {});
}

export async function withNerpErrorTracking<T>(
  integrationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    await markNerpSuccess(integrationId);
    return result;
  } catch (err) {
    await markNerpError(integrationId, err);

    if (err instanceof NerpHttpError) {
      if (err.isAuthError()) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Autenticação com nerp falhou. Reconecte a integração.",
        });
      }
      if (err.status === 404) {
        throw new ORPCError("NOT_FOUND", { message: err.message });
      }
      if (err.status >= 400 && err.status < 500) {
        throw new ORPCError("BAD_REQUEST", { message: err.message });
      }
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Falha ao chamar nerp: ${err.message}`,
      });
    }

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: err instanceof Error ? err.message : "Erro chamando nerp",
    });
  }
}
