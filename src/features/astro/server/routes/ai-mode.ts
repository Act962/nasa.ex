import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { envKeyFor } from "@/features/ia/lib/router/providers";
import {
  ORBITA_PLATFORM_MODEL,
  hasOwnAiKey,
  resolveAstroAiMode,
  saveAstroAiMode,
} from "@/features/astro/lib/resolve-astro-ai-mode";

/** IA do ASTRO na organização ativa (spec 0053): o que está valendo e a troca para o modelo ÓRBITA. */

export const getAstroAiMode = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/astro/ai-mode", summary: "Get the ASTRO AI mode of the active organization" })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();
    const [mode, isOwnKeyConnected] = await Promise.all([
      resolveAstroAiMode(organizationId),
      hasOwnAiKey(organizationId),
    ]);
    // IA que a equipe ÓRBITA mantém ativa para todos: aparece sempre em órbita do ASTRO.
    const platformAiPlatforms = envKeyFor("google") ? ["GEMINI"] : [];
    return {
      mode,
      isOwnKeyConnected,
      platformModelId: ORBITA_PLATFORM_MODEL.modelId,
      platformAiPlatforms,
    };
  });

export const setAstroAiMode = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/astro/ai-mode", summary: "Choose the ÓRBITA model for ASTRO" })
  .input(z.object({ mode: z.literal("PLATFORM") }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();
    await saveAstroAiMode(organizationId, input.mode);
    return { mode: await resolveAstroAiMode(organizationId) };
  });
