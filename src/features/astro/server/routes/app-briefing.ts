import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { ASTRO_BRIEFING_APPS, type AstroBriefingApp } from "@/features/astro/lib/astro-briefing-apps";
import { buildRestrictedBriefingMessage, canViewAppBriefing } from "@/features/astro/server/briefings/briefing-access";
import {
  buildAgendaBriefing,
  buildChatBriefing,
  buildFormsBriefing,
  buildForgeBriefing,
  buildTrackingBriefing,
  buildWorkspaceBriefing,
  computeBriefingPeriod,
  type BriefingAudience,
} from "@/features/astro/server/briefings/build-app-briefings";
import {
  buildAccountingBriefing,
  buildCampanhasBriefing,
  buildContactsBriefing,
  buildFinanceBriefing,
  buildInsightsBriefing,
  buildIntegrationsBriefing,
  buildLinnkerBriefing,
  buildNBoxBriefing,
  buildPagesBriefing,
  buildPlannerBriefing,
  buildRouteBriefing,
  buildSpaceHelpBriefing,
  buildSpaceStationBriefing,
  buildStarFriendsBriefing,
  buildTrafegoBriefing,
} from "@/features/astro/server/briefings/build-more-app-briefings";

/** Resumo do App aberto, na voz do Astro, para o painel (spec 0056). Só leitura no banco: zero tokens, zero Stars. */

const BRIEFING_BUILDERS: Record<AstroBriefingApp, (audience: BriefingAudience) => Promise<string>> = {
  forms: buildFormsBriefing,
  tracking: buildTrackingBriefing,
  chat: buildChatBriefing,
  agenda: buildAgendaBriefing,
  workspace: buildWorkspaceBriefing,
  forge: buildForgeBriefing,
  campanhas: buildCampanhasBriefing,
  contacts: buildContactsBriefing,
  pages: buildPagesBriefing,
  linnker: buildLinnkerBriefing,
  nbox: buildNBoxBriefing,
  insights: buildInsightsBriefing,
  planner: buildPlannerBriefing,
  route: buildRouteBriefing,
  trafego: buildTrafegoBriefing,
  integrations: buildIntegrationsBriefing,
  starFriends: buildStarFriendsBriefing,
  spaceStation: buildSpaceStationBriefing,
  spaceHelp: buildSpaceHelpBriefing,
  finance: buildFinanceBriefing,
  accounting: buildAccountingBriefing,
};

function toFirstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || "Olá";
}

export const getAstroAppBriefing = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/astro/app-briefing", summary: "Resumo do App aberto no painel do Astro" })
  .input(z.object({ app: z.enum(ASTRO_BRIEFING_APPS) }))
  .handler(async ({ input, context }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) return { message: null, isRestricted: false };

    const firstName = toFirstName(context.user.name);
    // Sem acesso aos dados do App, o Astro avisa em vez de calar ou vazar números (spec 0056, RF-10).
    const isAllowed = await canViewAppBriefing(input.app, organizationId, context.user);
    if (!isAllowed) return { message: buildRestrictedBriefingMessage(input.app, firstName), isRestricted: true };

    const message = await BRIEFING_BUILDERS[input.app]({
      organizationId,
      userId: context.user.id,
      firstName,
      period: computeBriefingPeriod(),
    });
    return { message, isRestricted: false };
  });
