import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { createExternalAiToken, listExternalAiTokens, revokeExternalAiToken } from "@/features/external-ai/server/access-tokens";

/** Chaves de acesso de IA externa ao MCP (spec 0065, RF-5). Cada usuário vê e revoga só as próprias. */

const listTokens = base.use(requiredAuthMiddleware).handler(async ({ context }) => ({ tokens: await listExternalAiTokens(context.user.id) }));

const createToken = base
  .use(requiredAuthMiddleware)
  .input(z.object({ label: z.string().trim().min(2, "Dê um nome à chave").max(80), organizationIds: z.array(z.string()).min(1).max(50) }))
  .handler(async ({ input, context }) => createExternalAiToken({ userId: context.user.id, label: input.label, organizationIds: input.organizationIds }));

const revokeToken = base
  .use(requiredAuthMiddleware)
  .input(z.object({ tokenId: z.string() }))
  .handler(async ({ input, context }) => {
    await revokeExternalAiToken(context.user.id, input.tokenId);
    return { ok: true as const };
  });

export const externalAiRouter = {
  tokens: { list: listTokens, create: createToken, revoke: revokeToken },
};
