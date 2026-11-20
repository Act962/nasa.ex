import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import {
  createExternalAiToken,
  isSystemAdmin,
  listExternalAiTokens,
  revokeExternalAiToken,
} from "@/features/external-ai/server/access-tokens";
import { disconnectOAuthConnection, listOAuthConnections } from "@/features/external-ai/server/oauth-connections";

/** Chaves de acesso de IA externa ao MCP (spec 0065, RF-5). Cada usuário vê e revoga só as próprias. */

const listTokens = base.use(requiredAuthMiddleware).handler(async ({ context }) => ({
  tokens: await listExternalAiTokens(context.user.id),
  // A opção do trafeGO só aparece para a equipe (spec 0131, RF-1).
  canIncludeTrafego: await isSystemAdmin(context.user.id),
}));

const createToken = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      label: z.string().trim().min(2, "Dê um nome à chave").max(80),
      organizationIds: z.array(z.string()).min(1).max(50),
      includeTrafego: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) =>
    createExternalAiToken({
      userId: context.user.id,
      label: input.label,
      organizationIds: input.organizationIds,
      includeTrafego: input.includeTrafego,
    }),
  );

const revokeToken = base
  .use(requiredAuthMiddleware)
  .input(z.object({ tokenId: z.string() }))
  .handler(async ({ input, context }) => {
    await revokeExternalAiToken(context.user.id, input.tokenId);
    return { ok: true as const };
  });

/** IAs conectadas por OAuth (spec 0135, RF-11, RF-12): cada pessoa vê e desconecta só as próprias. */
const listConnections = base.use(requiredAuthMiddleware).handler(async ({ context }) => ({
  connections: await listOAuthConnections(context.user.id),
}));

const disconnectConnection = base
  .use(requiredAuthMiddleware)
  .input(z.object({ connectionId: z.string() }))
  .handler(async ({ input, context }) => ({ isDisconnected: await disconnectOAuthConnection(context.user.id, input.connectionId) }));

export const externalAiRouter = {
  tokens: { list: listTokens, create: createToken, revoke: revokeToken },
  connections: { list: listConnections, disconnect: disconnectConnection },
};
