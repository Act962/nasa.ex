import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPlannerOrganizationAccess } from "@/features/nasa-planner/server/cross-org";
import { addBrandKitAsset, getBrandKit, removeBrandKitAsset, saveBrandKitIdentity } from "@/features/nasa-planner/server/brand-kit/brand-kit";
import { generatePlannerScripts } from "@/features/nasa-planner/server/brand-kit/generate-scripts";

/** Kit da Marca e "Gerar com o Astro" (spec 0063). Ler exige `view`; mudar e gerar exigem `create`, na org do cliente. */

const nullableText = z.string().trim().max(2000).nullable().optional();
const textList = z.array(z.string().trim().min(1).max(200)).max(50).optional();
const logoValue = z.string().trim().max(1000).nullable().optional();

export const getPlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "view");
    return getBrandKit(input.organizationId);
  });

export const savePlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      logos: z.object({ color: logoValue, black: logoValue, white: logoValue, icon: logoValue, horizontal: logoValue }).partial().optional(),
      palette: z.array(z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Cor em hexadecimal, ex.: #1D4ED8")).max(12).optional(),
      brandName: z.string().trim().max(120).nullable().optional(),
      fontHeading: nullableText,
      fontBody: nullableText,
      voiceTone: nullableText,
      audience: nullableText,
      positioning: nullableText,
      slogan: nullableText,
      website: nullableText,
      keyMessages: textList,
      forbiddenWords: textList,
      defaultHashtags: textList,
      defaultCtas: textList,
    }),
  )
  .handler(async ({ input, context }) => {
    const { organizationId, ...identity } = input;
    await assertPlannerOrganizationAccess(context.user.id, organizationId, "create");
    return saveBrandKitIdentity(organizationId, identity);
  });

export const addPlannerBrandKitAsset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      kind: z.enum(["BACKGROUND", "PRODUCT", "MATERIAL", "REFERENCE_POST"]),
      title: z.string().trim().min(1, "Dê um nome").max(160),
      description: nullableText,
      fileKey: z.string().trim().max(1000).nullable().optional(),
      url: z.string().trim().max(1000).nullable().optional(),
      price: z.string().trim().max(60).nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { organizationId, ...asset } = input;
    await assertPlannerOrganizationAccess(context.user.id, organizationId, "create");
    const created = await addBrandKitAsset(organizationId, asset);
    return { assetId: created.id };
  });

export const removePlannerBrandKitAsset = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), assetId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    await removeBrandKitAsset(input.organizationId, input.assetId);
    return { ok: true as const };
  });

export const generateScriptsWithAstro = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      idea: z.string().trim().min(5, "Conte a ideia em uma frase").max(2000),
      formats: z.array(z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"])).min(1).max(4),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    return generatePlannerScripts({ ...input, userId: context.user.id });
  });
