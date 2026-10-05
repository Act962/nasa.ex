import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPlannerOrganizationAccess } from "@/features/nasa-planner/server/cross-org";
import { addBrandKitAsset, getBrandKit, removeBrandKitAsset, saveBrandKitIdentity } from "@/features/nasa-planner/server/brand-kit/brand-kit";
import {
  createBrandKit,
  deleteBrandKit,
  getBrandKitForInstagramAccount,
  listBrandKits,
  renameBrandKit,
  setInstagramAccountBrandKit,
} from "@/features/nasa-planner/server/brand-kit/brand-kits";
import { generatePlannerScripts } from "@/features/nasa-planner/server/brand-kit/generate-scripts";
import { isOrgAdmin, requireOrgAdmin } from "../../comments/_shared";

/**
 * Kit da Marca e "Gerar com o Astro" (specs 0063 e 0070). Ler exige `view`; mudar e gerar exigem
 * `create`, na org do cliente. `brandKitId` nulo ou ausente é o kit padrão da empresa.
 */

const nullableText = z.string().trim().max(2000).nullable().optional();
const textList = z.array(z.string().trim().min(1).max(200)).max(50).optional();
const logoValue = z.string().trim().max(1000).nullable().optional();
const brandKitIdField = z.string().nullable().optional();
const kitName = z.string().trim().min(1, "Dê um nome ao kit").max(80);

export const listPlannerBrandKits = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "view");
    const [brandKits, canLinkAccounts] = await Promise.all([
      listBrandKits(input.organizationId),
      isOrgAdmin(input.organizationId, context.user.id),
    ]);
    return { ...brandKits, canLinkAccounts };
  });

export const getPlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      brandKitId: brandKitIdField,
      /** Em vez do kit, a conta do Instagram do post: devolve o kit que ela usa (spec 0070, RF-8). */
      instagramAccountId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "view");
    if (input.instagramAccountId) return getBrandKitForInstagramAccount(input.organizationId, input.instagramAccountId);
    return getBrandKit(input.organizationId, input.brandKitId ?? null);
  });

export const createPlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), name: kitName, shouldCopyDefault: z.boolean().default(false) }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    return createBrandKit({ ...input, createdById: context.user.id });
  });

export const renamePlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), brandKitId: z.string(), name: kitName }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    return renameBrandKit(input.organizationId, input.brandKitId, input.name);
  });

/** Só kit adicional: o padrão não tem id, então não há como pedi-lo aqui (spec 0070, CA-7). */
export const deletePlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), brandKitId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    return deleteBrandKit(input.organizationId, input.brandKitId);
  });

/** Escolhe o kit de uma conta do Instagram; mexe em configuração da conta, então é de owner e admin (RF-7). */
export const setPlannerAccountBrandKit = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), channelId: z.string().min(1), brandKitId: z.string().nullable() }))
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(input.organizationId, context.user.id);
    return setInstagramAccountBrandKit(input.organizationId, input.channelId, input.brandKitId);
  });

export const savePlannerBrandKit = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      brandKitId: brandKitIdField,
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
    const { organizationId, brandKitId, ...identity } = input;
    await assertPlannerOrganizationAccess(context.user.id, organizationId, "create");
    return saveBrandKitIdentity(organizationId, brandKitId ?? null, identity);
  });

export const addPlannerBrandKitAsset = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      brandKitId: brandKitIdField,
      kind: z.enum(["BACKGROUND", "PRODUCT", "MATERIAL", "REFERENCE_POST"]),
      title: z.string().trim().min(1, "Dê um nome").max(160),
      description: nullableText,
      fileKey: z.string().trim().max(1000).nullable().optional(),
      url: z.string().trim().max(1000).nullable().optional(),
      price: z.string().trim().max(60).nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { organizationId, brandKitId, ...asset } = input;
    await assertPlannerOrganizationAccess(context.user.id, organizationId, "create");
    const created = await addBrandKitAsset(organizationId, brandKitId ?? null, asset);
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
      /** Conta do Instagram em que o conteúdo vai sair: define o kit (spec 0070, RF-8). */
      instagramAccountId: z.string().nullable().optional(),
      idea: z.string().trim().min(5, "Conte a ideia em uma frase").max(2000),
      formats: z.array(z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"])).min(1).max(4),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "create");
    return generatePlannerScripts({ ...input, userId: context.user.id });
  });
