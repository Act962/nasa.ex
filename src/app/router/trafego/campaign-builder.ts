import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { takeRateLimit } from "@/lib/rate-limit";
import { MetaGraphError } from "@/http/meta/graph-client";
import {
  MAX_AGE,
  MAX_RADIUS_KM,
  MIN_AGE,
  MIN_RADIUS_KM,
} from "@/features/trafego/lib/campaign-builder/build-meta-payloads";
import { resolveCampaignBuilderAccess } from "@/features/trafego/server/lib/campaign-builder/builder-access";
import {
  CampaignBuilderError,
  getBuilderContext,
  listBuilderInstagramPosts,
  requireBuilderPage,
  searchBuilderCities,
  suggestBuilderAudience,
} from "@/features/trafego/server/lib/campaign-builder/builder-context";
import {
  createCampaignDraft,
  publishCampaign,
  type BuilderActor,
} from "@/features/trafego/server/lib/campaign-builder/builder-actions";
import {
  discardCampaignDraft,
  replaceCampaignAd,
  updateOrderCampaign,
} from "@/features/trafego/server/lib/campaign-builder/builder-edits";

/**
 * Construtor de campanha de WhatsApp do painel (spec 0124). Toda procedure passa pela
 * guarda no servidor antes de chamar a Meta (RF-1); a conta vem da org do pedido (RNF-3).
 */

const builderBase = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

type BuilderContextShape = {
  org: { id: string };
  user: { id: string; name: string; email: string; image?: string | null };
};

const orderInput = z.object({ orderId: z.string().min(1) });
const campaignIdSchema = z.string().regex(/^\d{1,30}$/, "Campanha inválida.");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const budgetSchema = z.number().int().min(100).max(50_000_000);

const audienceSchema = z.object({
  cityKey: z.string().regex(/^\d{1,20}$/, "Cidade inválida."),
  cityName: z.string().trim().min(1).max(120),
  radiusKm: z.number().int().min(MIN_RADIUS_KM).max(MAX_RADIUS_KM),
  ageMin: z.number().int().min(MIN_AGE).max(MAX_AGE),
  ageMax: z.number().int().min(MIN_AGE).max(MAX_AGE),
  gender: z.enum(["all", "male", "female"]),
});

const adSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("instagram_post"), mediaId: z.string().regex(/^\d{1,30}$/, "Post inválido.") }),
  z.object({ kind: z.literal("image"), creativeId: z.string().min(1), copyId: z.string().min(1) }),
]);

function toActor(context: BuilderContextShape): BuilderActor {
  return { id: context.user.id, name: context.user.name, email: context.user.email, image: context.user.image };
}

function assertWithinRateLimit(scope: string, userId: string, max: number) {
  const limit = takeRateLimit(`trafego-builder-${scope}`, userId, { max, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `Muitas tentativas seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
    });
  }
}

async function requireBuilder(context: BuilderContextShape, orderId: string) {
  const access = await resolveCampaignBuilderAccess({ orderId, organizationId: context.org.id, userId: context.user.id });
  if (access.ok) return access;
  if (access.reason === "not_found") throw new ORPCError("NOT_FOUND", { message: access.message });
  throw new ORPCError("FORBIDDEN", { message: access.message });
}

/** Erros conhecidos viram mensagem clara; a Meta pedindo para esperar não é repetido (CB-6). */
async function runBuilderStep<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    if (error instanceof ORPCError) throw error;
    if (error instanceof CampaignBuilderError) throw new ORPCError(error.code, { message: error.message });
    if (error instanceof MetaGraphError) throw new ORPCError("BAD_REQUEST", { message: error.userMessage });
    console.error("[trafego/campaign-builder]", error);
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Não foi possível concluir agora. Tente de novo." });
  }
}

/** Diz se a aba aparece e por que não deixa criar (RF-2, CA-1, CA-2). Não chama a Meta quando a guarda já barra. */
export const getCampaignBuilderAccess = builderBase.input(orderInput).handler(async ({ input, context }) => {
  const access = await resolveCampaignBuilderAccess({
    orderId: input.orderId,
    organizationId: context.org.id,
    userId: context.user.id,
  });
  if (access.ok) return { isVisible: true, canBuild: true, message: null };
  if (access.reason === "not_found") throw new ORPCError("NOT_FOUND", { message: access.message });
  const isVisible = access.reason !== "not_owner_or_admin" && access.reason !== "not_meta";
  return { isVisible, canBuild: false, message: access.message };
});

export const getCampaignBuilderContext = builderBase.input(orderInput).handler(async ({ input, context }) => {
  const access = await requireBuilder(context, input.orderId);
  return runBuilderStep(() => getBuilderContext(access.meta, access.order));
});

export const suggestCampaignAudience = builderBase.input(orderInput).handler(async ({ input, context }) => {
  const access = await requireBuilder(context, input.orderId);
  return runBuilderStep(() => suggestBuilderAudience(access.meta));
});

export const searchCampaignCities = builderBase
  .input(orderInput.extend({ query: z.string().trim().min(2).max(60) }))
  .handler(async ({ input, context }) => {
    assertWithinRateLimit("cities", context.user.id, 60);
    const access = await requireBuilder(context, input.orderId);
    return runBuilderStep(() => searchBuilderCities(access.meta, input.query));
  });

export const listCampaignInstagramPosts = builderBase
  .input(orderInput.extend({ pageId: z.string().regex(/^\d{1,30}$/) }))
  .handler(async ({ input, context }) => {
    const access = await requireBuilder(context, input.orderId);
    return runBuilderStep(async () => {
      const page = await requireBuilderPage(access.meta, input.pageId);
      return listBuilderInstagramPosts(access.meta, page);
    });
  });

export const createCampaignDraftProcedure = builderBase
  .input(
    orderInput.extend({
      draftKey: z.string().regex(/^[a-z0-9]{6,10}$/),
      pageId: z.string().regex(/^\d{1,30}$/),
      audience: audienceSchema,
      source: adSourceSchema,
      budgetBrlCents: budgetSchema,
      endDate: dateSchema,
      isComplementConfirmed: z.boolean().default(false),
      isPolicyWarningConfirmed: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context }) => {
    assertWithinRateLimit("create", context.user.id, 6);
    const access = await requireBuilder(context, input.orderId);
    const { orderId: _orderId, ...draftInput } = input;
    return runBuilderStep(() => createCampaignDraft(access.meta, access.order, draftInput, toActor(context)));
  });

export const publishCampaignProcedure = builderBase
  .input(orderInput.extend({ campaignId: campaignIdSchema }))
  .handler(async ({ input, context }) => {
    assertWithinRateLimit("publish", context.user.id, 10);
    const access = await requireBuilder(context, input.orderId);
    return runBuilderStep(() => publishCampaign(access.meta, access.order, input.campaignId, toActor(context)));
  });

export const discardCampaignDraftProcedure = builderBase
  .input(orderInput.extend({ campaignId: campaignIdSchema }))
  .handler(async ({ input, context }) => {
    assertWithinRateLimit("edit", context.user.id, 30);
    const access = await requireBuilder(context, input.orderId);
    return runBuilderStep(() => discardCampaignDraft(access.meta, access.order, input.campaignId, toActor(context)));
  });

export const updateCampaignProcedure = builderBase
  .input(
    orderInput.extend({
      campaignId: campaignIdSchema,
      change: z.discriminatedUnion("action", [
        z.object({ action: z.literal("pause") }),
        z.object({ action: z.literal("resume") }),
        z.object({
          action: z.literal("budget"),
          lifetimeBudgetBrlCents: budgetSchema,
          isComplementConfirmed: z.boolean().default(false),
        }),
        z.object({ action: z.literal("end_date"), endDate: dateSchema }),
        z.object({ action: z.literal("audience"), audience: audienceSchema }),
      ]),
    }),
  )
  .handler(async ({ input, context }) => {
    assertWithinRateLimit("edit", context.user.id, 30);
    const access = await requireBuilder(context, input.orderId);
    return runBuilderStep(() =>
      updateOrderCampaign(access.meta, access.order, input.campaignId, input.change, toActor(context)),
    );
  });

export const replaceCampaignAdProcedure = builderBase
  .input(
    orderInput.extend({
      campaignId: campaignIdSchema,
      source: adSourceSchema,
      isPolicyWarningConfirmed: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context }) => {
    assertWithinRateLimit("create", context.user.id, 6);
    const access = await requireBuilder(context, input.orderId);
    return runBuilderStep(() =>
      replaceCampaignAd(
        access.meta,
        access.order,
        { campaignId: input.campaignId, source: input.source, isPolicyWarningConfirmed: input.isPolicyWarningConfirmed },
        toActor(context),
      ),
    );
  });
