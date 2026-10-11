import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { aiPreferencesInputSchema } from "@/features/ia/lib/ai-preferences";
import { isCompanyAiManager } from "@/features/ia/server/load-ai-usage";
import { loadAiPreferences } from "@/features/ia/server/resolve-ai-for";
import prisma from "@/lib/prisma";

// Preferências de IA da empresa (spec 0093, etapa 2, RF-15): em quais recursos a chave própria vale e
// a faixa do modelo por uso. Só dono e admin leem e gravam.

const FORBIDDEN_MESSAGE = "Só o dono ou um administrador da empresa escolhe como a IA da empresa roda.";

export const getAiPreferences = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/ia/preferences", summary: "Preferências de IA da empresa" })
  .handler(async ({ context, errors }) => {
    if (!(await isCompanyAiManager(context.org.id, context.user.id))) throw errors.FORBIDDEN({ message: FORBIDDEN_MESSAGE });
    return loadAiPreferences(context.org.id);
  });

export const updateAiPreferences = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", path: "/ia/preferences", summary: "Gravar as preferências de IA da empresa" })
  .input(aiPreferencesInputSchema)
  .handler(async ({ input, context, errors }) => {
    if (!(await isCompanyAiManager(context.org.id, context.user.id))) throw errors.FORBIDDEN({ message: FORBIDDEN_MESSAGE });
    const preferences = { companyKeyResources: [...new Set(input.companyKeyResources)], useBands: input.useBands };
    await prisma.organization.update({ where: { id: context.org.id }, data: { aiPreferences: preferences } });
    return preferences;
  });
