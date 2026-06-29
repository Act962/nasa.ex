import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  fetchFacebookPageSummary,
  fetchFacebookTopPosts,
  type FacebookPageSummary,
  type FacebookPost,
} from "@/http/meta/facebook-pages-insights";
import { z } from "zod";
import { getMetaPageContext } from "./_pages-helpers";

/**
 * Facebook Pages Insights — endpoint Graph API (não Marketing API).
 *
 * Tolera falha graciosamente: token expirado / page sem permissão / sem
 * dados → estado vazio. UI mostra placeholder amigável nesses casos.
 */
export const getFacebookOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
      postsLimit: z.number().int().min(1).max(20).default(6),
    }),
  )
  .handler(async ({ input, context }) => {
    const ctx = await getMetaPageContext(context.org.id);
    if (!ctx.page) {
      return {
        connected: false,
        summary: null as FacebookPageSummary | null,
        topPosts: [] as FacebookPost[],
      };
    }

    const since = new Date(input.startDate);
    const until = new Date(input.endDate);

    let summary: FacebookPageSummary | null = null;
    let topPosts: FacebookPost[] = [];

    try {
      summary = await fetchFacebookPageSummary(
        ctx.page.id,
        ctx.page.accessToken,
        since,
        until,
      );
    } catch (err) {
      return {
        connected: true,
        summary: null,
        topPosts: [] as FacebookPost[],
        pageName: ctx.page.name,
        error: err instanceof Error ? err.message : "Erro Facebook Pages",
      };
    }

    try {
      topPosts = await fetchFacebookTopPosts(
        ctx.page.id,
        ctx.page.accessToken,
        input.postsLimit,
      );
    } catch {
      topPosts = [];
    }

    return {
      connected: true,
      summary,
      topPosts,
      pageName: ctx.page.name,
    };
  });
