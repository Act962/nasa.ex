import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { CommentsHttpError } from "@/http/comments/types";

export async function markCommentsSuccess(
  integrationId: string,
): Promise<void> {
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

export async function markCommentsError(
  integrationId: string,
  err: unknown,
): Promise<void> {
  const message =
    err instanceof CommentsHttpError
      ? `[${err.status}${err.code ? ` ${err.code}` : ""}] ${err.message}`
      : err instanceof Error
        ? err.message
        : "Erro desconhecido na integração Comments App";

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

export async function withCommentsErrorTracking<T>(
  integrationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    await markCommentsSuccess(integrationId);
    return result;
  } catch (err) {
    await markCommentsError(integrationId, err);

    if (err instanceof CommentsHttpError) {
      if (err.isAuthError()) {
        throw new ORPCError("UNAUTHORIZED", {
          message:
            "Autenticação com Comments App falhou. Reconecte a integração.",
        });
      }
      if (err.status === 404) {
        throw new ORPCError("NOT_FOUND", { message: err.message });
      }
      if (err.status >= 400 && err.status < 500) {
        throw new ORPCError("BAD_REQUEST", { message: err.message });
      }
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Falha ao chamar Comments App: ${err.message}`,
      });
    }

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: err instanceof Error ? err.message : "Erro chamando Comments App",
    });
  }
}
