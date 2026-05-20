import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  fetchInstagramAccountSummary,
  fetchInstagramTopMedia,
  type InstagramAccountSummary,
  type InstagramMedia,
} from "@/http/meta/instagram-insights";
import { z } from "zod";
import { getMetaPageContext } from "./_pages-helpers";

/**
 * Instagram Business Insights — endpoint NÃO é Marketing API, é Graph API
 * direto no IG User. Usa Page Access Token (vem da config Meta) + IG User ID
 * (ligado à page).
 *
 * Toda procedure tolera falhas graciosamente: se o token expirou, IG não
 * está conectado, ou não há dados → retorna estado vazio (sem jogar erro).
 */
export const getInstagramOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      startDate: z.string(),
      endDate: z.string(),
      mediaLimit: z.number().int().min(1).max(20).default(6),
    }),
  )
  .handler(async ({ input, context }) => {
    const ctx = await getMetaPageContext(context.org.id);
    if (!ctx.page || !ctx.igAccount) {
      return {
        connected: false,
        summary: null as InstagramAccountSummary | null,
        topMedia: [] as InstagramMedia[],
        topReels: [] as InstagramMedia[],
      };
    }

    const since = new Date(input.startDate);
    const until = new Date(input.endDate);

    let summary: InstagramAccountSummary | null = null;
    let media: InstagramMedia[] = [];

    try {
      summary = await fetchInstagramAccountSummary(
        ctx.igAccount.id,
        ctx.page.accessToken,
        since,
        until,
      );
    } catch (err) {
      // Token expirou ou IG não tem dados — segue retornando o que conseguir.
      return {
        connected: true,
        summary: null,
        topMedia: [] as InstagramMedia[],
        topReels: [] as InstagramMedia[],
        error: err instanceof Error ? err.message : "Erro Instagram",
      };
    }

    try {
      media = await fetchInstagramTopMedia(
        ctx.igAccount.id,
        ctx.page.accessToken,
        input.mediaLimit * 2, // pede o dobro pra separar posts vs reels depois
      );
    } catch {
      media = [];
    }

    const topReels = media.filter((m) => m.mediaType === "REEL").slice(0, input.mediaLimit);
    const topMedia = media
      .filter((m) => m.mediaType !== "REEL")
      .slice(0, input.mediaLimit);

    // Enriquece o summary com totais agregados a partir das mídias do período
    // (totalViews + savedTotal + reelsInteractionRate).
    if (summary) {
      const totalViews = media.reduce((s, m) => s + m.viewsCount, 0);
      const savedTotal = media.reduce((s, m) => s + m.saved, 0);
      const reels = media.filter((m) => m.mediaType === "REEL");
      const reelsEng = reels.reduce(
        (s, r) => s + r.likeCount + r.commentsCount + r.saved,
        0,
      );
      const reelsPlays = reels.reduce((s, r) => s + r.viewsCount, 0);
      const reelsInteractionRate =
        reelsPlays > 0 ? (reelsEng / reelsPlays) * 100 : 0;

      summary = {
        ...summary,
        totalViews,
        savedTotal,
        reelsInteractionRate,
      };
    }

    return {
      connected: true,
      summary,
      topMedia,
      topReels,
      username: ctx.igAccount.username,
    };
  });
