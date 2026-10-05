import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_BRAND_KIT_NAME,
  findAdditionalBrandKit,
  getBrandKit,
  readDefaultBrandKitIdentity,
} from "./brand-kit";

/**
 * Kits adicionais de uma empresa e o vínculo de cada conta do Instagram com um kit (spec 0070).
 * O post nunca guarda o kit: resolve pela conta em que vai sair, na hora (D-3).
 */

/** Teto de kits adicionais por empresa (spec 0070, RNF-3). */
export const MAX_ADDITIONAL_BRAND_KITS = 20;

const INSTAGRAM_PROVIDER = "INSTAGRAM";

const toNameKey = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

function assertNameIsFree(name: string) {
  if (toNameKey(name) === toNameKey(DEFAULT_BRAND_KIT_NAME)) {
    throw new ORPCError("CONFLICT", { message: "Esse é o nome do kit padrão. Escolha outro nome." });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const DUPLICATE_NAME_MESSAGE = "Já existe um kit com esse nome nesta empresa.";

/** Kits da empresa (o padrão primeiro) com o medidor de cada um, e as contas do Instagram com o kit que usam. */
export async function listBrandKits(organizationId: string) {
  const [additionalKits, channels] = await Promise.all([
    prisma.brandKit.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.socialChannel.findMany({
      where: { organizationId, provider: INSTAGRAM_PROVIDER },
      orderBy: { createdAt: "asc" },
      select: { id: true, handle: true, externalAccountId: true, status: true, brandKitId: true },
    }),
  ]);

  const kitRefs: Array<{ brandKitId: string | null; name: string }> = [
    { brandKitId: null, name: DEFAULT_BRAND_KIT_NAME },
    ...additionalKits.map((kit) => ({ brandKitId: kit.id, name: kit.name })),
  ];
  const kits = await Promise.all(
    kitRefs.map(async (kitRef) => {
      const kit = await getBrandKit(organizationId, kitRef.brandKitId);
      return {
        brandKitId: kitRef.brandKitId,
        name: kitRef.name,
        isDefault: kitRef.brandKitId === null,
        completeness: kit.completeness,
        accountCount: channels.filter((channel) => channel.brandKitId === kitRef.brandKitId).length,
      };
    }),
  );

  return {
    kits,
    accounts: channels.map((channel) => ({
      id: channel.id,
      handle: channel.handle,
      externalAccountId: channel.externalAccountId,
      status: channel.status,
      brandKitId: channel.brandKitId,
    })),
    limit: MAX_ADDITIONAL_BRAND_KITS,
  };
}

export async function createBrandKit(input: { organizationId: string; name: string; shouldCopyDefault: boolean; createdById: string }) {
  assertNameIsFree(input.name);
  const existingCount = await prisma.brandKit.count({ where: { organizationId: input.organizationId } });
  if (existingCount >= MAX_ADDITIONAL_BRAND_KITS) {
    throw new ORPCError("BAD_REQUEST", { message: `Esta empresa já tem ${MAX_ADDITIONAL_BRAND_KITS} kits adicionais, que é o limite. Apague um kit que não usa mais.` });
  }

  // A cópia leva só texto: logo copiado apontaria para o mesmo arquivo do kit padrão (spec 0070, D-5).
  const baseIdentity = input.shouldCopyDefault ? await readDefaultBrandKitIdentity(input.organizationId) : null;

  try {
    const created = await prisma.brandKit.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        nameKey: toNameKey(input.name),
        createdById: input.createdById,
        ...(baseIdentity && {
          brandName: baseIdentity.brandName,
          palette: baseIdentity.palette,
          fontHeading: baseIdentity.fontHeading,
          fontBody: baseIdentity.fontBody,
          voiceTone: baseIdentity.voiceTone,
          audience: baseIdentity.audience,
          positioning: baseIdentity.positioning,
          slogan: baseIdentity.slogan,
          website: baseIdentity.website,
          keyMessages: baseIdentity.keyMessages,
          forbiddenWords: baseIdentity.forbiddenWords,
          defaultHashtags: baseIdentity.defaultHashtags,
          defaultCtas: baseIdentity.defaultCtas,
        }),
      },
      select: { id: true, name: true },
    });
    return { brandKitId: created.id, name: created.name };
  } catch (error) {
    if (isUniqueViolation(error)) throw new ORPCError("CONFLICT", { message: DUPLICATE_NAME_MESSAGE });
    throw error;
  }
}

export async function renameBrandKit(organizationId: string, brandKitId: string, name: string) {
  assertNameIsFree(name);
  const kit = await findAdditionalBrandKit(organizationId, brandKitId);
  try {
    await prisma.brandKit.update({ where: { id: kit.id }, data: { name: name.trim(), nameKey: toNameKey(name) } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ORPCError("CONFLICT", { message: DUPLICATE_NAME_MESSAGE });
    throw error;
  }
  return { brandKitId: kit.id, name: name.trim() };
}

/** As contas que usavam o kit voltam ao padrão (FK `SetNull`) e os materiais dele somem (FK `Cascade`). */
export async function deleteBrandKit(organizationId: string, brandKitId: string) {
  const kit = await findAdditionalBrandKit(organizationId, brandKitId);
  const [releasedAccountCount, removedAssetCount] = await Promise.all([
    prisma.socialChannel.count({ where: { organizationId, brandKitId: kit.id } }),
    prisma.brandKitAsset.count({ where: { organizationId, brandKitId: kit.id } }),
  ]);
  await prisma.brandKit.delete({ where: { id: kit.id } });
  return { releasedAccountCount, removedAssetCount };
}

/** `brandKitId` nulo devolve a conta ao kit padrão. Conta e kit precisam ser da mesma empresa (RNF-4). */
export async function setInstagramAccountBrandKit(organizationId: string, channelId: string, brandKitId: string | null) {
  if (brandKitId) await findAdditionalBrandKit(organizationId, brandKitId);
  const updated = await prisma.socialChannel.updateMany({
    where: { id: channelId, organizationId, provider: INSTAGRAM_PROVIDER },
    data: { brandKitId },
  });
  if (updated.count === 0) throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
  return { channelId, brandKitId };
}

/**
 * Kit da conta do Instagram em que o conteúdo vai sair. Sem conta, com conta que não está nos
 * Satélites ou com conta sem vínculo, é o kit padrão (spec 0070, RF-9).
 */
export async function resolveBrandKitIdForInstagramAccount(organizationId: string, instagramAccountId: string | null | undefined) {
  if (!instagramAccountId) return null;
  const channel = await prisma.socialChannel.findFirst({
    where: { organizationId, provider: INSTAGRAM_PROVIDER, externalAccountId: instagramAccountId },
    select: { brandKitId: true },
  });
  return channel?.brandKitId ?? null;
}

export async function getBrandKitForInstagramAccount(organizationId: string, instagramAccountId: string | null | undefined) {
  return getBrandKit(organizationId, await resolveBrandKitIdForInstagramAccount(organizationId, instagramAccountId));
}

/** O mesmo, a partir do @ da conta — é como o Astro e o MCP a conhecem (spec 0070, RF-11). */
export async function getBrandKitForInstagramHandle(organizationId: string, instagramHandle: string | null | undefined) {
  const handle = instagramHandle?.trim().replace(/^@/, "");
  if (!handle) return getBrandKit(organizationId);
  const channel = await prisma.socialChannel.findFirst({
    where: { organizationId, provider: INSTAGRAM_PROVIDER, handle: { equals: handle, mode: "insensitive" } },
    select: { brandKitId: true },
  });
  return getBrandKit(organizationId, channel?.brandKitId ?? null);
}

/** Resumo dos kits para quem cria conteúdo de fora: nome, se está completo e as contas de cada um. */
export async function summarizeBrandKits(organizationId: string) {
  const { kits, accounts } = await listBrandKits(organizationId);
  return kits.map((kit) => ({
    name: kit.name,
    isDefault: kit.isDefault,
    isComplete: kit.completeness.isComplete,
    missing: kit.completeness.missing,
    instagramAccounts: accounts
      .filter((account) => account.brandKitId === kit.brandKitId && account.handle)
      .map((account) => `@${account.handle}`),
  }));
}

export function getBrandKitForPost(post: { organizationId: string; targetIgAccountId: string | null }) {
  return getBrandKitForInstagramAccount(post.organizationId, post.targetIgAccountId);
}
