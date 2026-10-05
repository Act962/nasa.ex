// Conferência da spec 0070 (vários Kits da Marca por empresa, vinculados à
// conta do Instagram) contra o Postgres local. Não há runner de testes no
// projeto (CLAUDE.md, regra 20): cada CA-n / CB-n vira uma asserção aqui.
// Cria duas empresas descartáveis e apaga tudo no fim.
//
//   pnpm tsx --conditions=react-server scripts/brand-kits-qa-check.ts

import "dotenv/config";
import prisma from "../src/lib/prisma";
import { tenantScope } from "../src/modules/shared/domain/tenant-scope";
import { createSocialRepositories } from "../src/modules/social";
import {
  addBrandKitAsset,
  buildBrandKitPrompt,
  getBrandKit,
  saveBrandKitIdentity,
} from "../src/features/nasa-planner/server/brand-kit/brand-kit";
import {
  createBrandKit,
  deleteBrandKit,
  getBrandChecklistRulesForPost,
  getBrandKitForInstagramAccount,
  getBrandKitForInstagramHandle,
  getBrandKitForPost,
  listBrandKits,
  MAX_ADDITIONAL_BRAND_KITS,
  renameBrandKit,
  setInstagramAccountBrandKit,
} from "../src/features/nasa-planner/server/brand-kit/brand-kits";
import { buildBrandChecklist } from "../src/features/nasa-planner/lib/brand-checklist";

const RUN_ID = `qa0070-${Date.now()}`;
const failures: string[] = [];
let assertionCount = 0;

function check(criterion: string, description: string, isOk: boolean) {
  assertionCount += 1;
  console.log(`  ${isOk ? "✅" : "❌"} ${criterion} — ${description}`);
  if (!isOk) failures.push(`${criterion} — ${description}`);
}

/** Código do erro oRPC lançado, ou null se a chamada passou. */
async function errorCodeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "UNKNOWN";
  }
}

async function createOrganization(label: string) {
  return prisma.organization.create({
    data: { name: `QA 0070 ${label}`, slug: `${RUN_ID}-${label}`, createdAt: new Date() },
    select: { id: true },
  });
}

async function connectAccount(organizationId: string, externalAccountId: string, handle: string) {
  const { channels } = createSocialRepositories(tenantScope(organizationId));
  const { channel } = await channels.connect({
    provider: "INSTAGRAM",
    externalAccountId,
    handle,
    credentials: { accessToken: `token-${handle}`, appSecret: "a".repeat(32), verifyToken: `verify-${handle}` },
    webhookPathToken: `${RUN_ID}-${handle}`,
  });
  return channel;
}

const CHECKLIST_POST = { type: "STATIC" as const, title: "Oferta", caption: "Leve hoje com preço imbatível", hashtags: [] };
const hasForbiddenWordWarning = (forbiddenWords: string[]) =>
  buildBrandChecklist(CHECKLIST_POST, { forbiddenWords, defaultHashtags: [] }).find((item) => item.id === "forbidden-words")?.status === "warn";

async function main() {
  const organization = await createOrganization("a");
  const otherOrganization = await createOrganization("b");
  const organizationId = organization.id;
  const accountSuffix = RUN_ID.replace(/\D/g, "").slice(-9);
  const defaultAccountId = `1784${accountSuffix}0001`;
  const clientAccountId = `1784${accountSuffix}0002`;

  try {
    console.log("\nKit padrão continua o mesmo");
    await saveBrandKitIdentity(organizationId, null, {
      brandName: "Matriz",
      voiceTone: "direta e otimista",
      palette: ["#111111", "#eeeeee"],
      forbiddenWords: ["barato"],
      slogan: "Slogan da matriz",
    });
    await addBrandKitAsset(organizationId, null, { kind: "PRODUCT", title: "Produto da matriz" });
    const defaultBefore = await getBrandKit(organizationId);
    const organizationBrandBefore = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { brandVoiceTone: true, brandPaletteHex: true, brandSlogan: true },
    });
    check("CA-1", "kit padrão lê os dados de marca da empresa e não tem id",
      defaultBefore.brandKitId === null && defaultBefore.voiceTone === "direta e otimista" && defaultBefore.assets.length === 1);
    check("CA-9", "editar o kit padrão grava na marca da empresa (Configurações → Marca)",
      organizationBrandBefore.brandVoiceTone === "direta e otimista" && organizationBrandBefore.brandSlogan === "Slogan da matriz");

    console.log("\nKit adicional");
    const copied = await createBrandKit({ organizationId, name: "Cliente B", shouldCopyDefault: true, createdById: "qa" });
    const copiedKit = await getBrandKit(organizationId, copied.brandKitId);
    check("CA-13", "cópia traz textos e cores, sem logos nem materiais",
      copiedKit.voiceTone === "direta e otimista" && copiedKit.palette.length === 2 && copiedKit.forbiddenWords.includes("barato") &&
      copiedKit.assets.length === 0 && Object.values(copiedKit.logos).every((logo) => logo === null));

    await saveBrandKitIdentity(organizationId, copied.brandKitId, {
      brandName: "Cliente B",
      voiceTone: "formal e técnica",
      forbiddenWords: ["imbatível"],
      logos: { color: "logos/cliente-b.png" },
    });
    await addBrandKitAsset(organizationId, copied.brandKitId, { kind: "PRODUCT", title: "Produto do cliente B" });
    const clientKit = await getBrandKit(organizationId, copied.brandKitId);
    const defaultAfter = await getBrandKit(organizationId);
    const organizationBrandAfter = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { brandVoiceTone: true, brandLogoUrl: true },
    });
    check("CA-10", "editar o kit adicional não muda a marca da empresa",
      organizationBrandAfter.brandVoiceTone === "direta e otimista" && organizationBrandAfter.brandLogoUrl === null &&
      defaultAfter.voiceTone === "direta e otimista" && defaultAfter.forbiddenWords.join() === "barato");
    check("CB-11", "material de um kit não aparece no outro",
      clientKit.assets.map((asset) => asset.title).join() === "Produto do cliente B" &&
      defaultAfter.assets.map((asset) => asset.title).join() === "Produto da matriz");
    check("RF-4", "cada kit tem o próprio medidor",
      clientKit.completeness.missing.join() !== defaultAfter.completeness.missing.join());

    check("CB-7", "nome repetido é recusado, sem diferenciar maiúsculas",
      (await errorCodeOf(() => createBrandKit({ organizationId, name: "cliente b", shouldCopyDefault: false, createdById: "qa" }))) === "CONFLICT" &&
      (await errorCodeOf(() => createBrandKit({ organizationId, name: "Padrão da Empresa", shouldCopyDefault: false, createdById: "qa" }))) === "CONFLICT");

    console.log("\nKit pela conta do Instagram");
    const defaultAccount = await connectAccount(organizationId, defaultAccountId, "loja_matriz_qa");
    const clientAccount = await connectAccount(organizationId, clientAccountId, "cliente_b_qa");
    await setInstagramAccountBrandKit(organizationId, clientAccount.id, copied.brandKitId);

    const kitOfClientPost = await getBrandKitForPost({ organizationId, targetIgAccountId: clientAccountId });
    const kitOfDefaultPost = await getBrandKitForPost({ organizationId, targetIgAccountId: defaultAccountId });
    const clientPrompt = buildBrandKitPrompt(kitOfClientPost);
    check("CA-2", "post da conta vinculada usa a voz e os produtos do kit dela, e nada do padrão",
      kitOfClientPost.brandKitId === copied.brandKitId && clientPrompt.includes("formal e técnica") &&
      clientPrompt.includes("Produto do cliente B") && !clientPrompt.includes("Produto da matriz") && !clientPrompt.includes("direta e otimista"));
    check("CA-3", "conta sem vínculo usa o kit padrão", kitOfDefaultPost.brandKitId === null && kitOfDefaultPost.voiceTone === "direta e otimista");
    check("CA-4", "o medidor que trava a geração é o do kit da conta",
      kitOfClientPost.completeness.missing.join() === clientKit.completeness.missing.join());
    check("CB-4", "post sem conta do Instagram usa o kit padrão",
      (await getBrandKitForPost({ organizationId, targetIgAccountId: null })).brandKitId === null);
    check("CB-5", "conta que não está nos Satélites usa o kit padrão",
      (await getBrandKitForInstagramAccount(organizationId, "17840000000009999")).brandKitId === null);
    check("RF-11", "Astro e MCP acham o kit pelo @ da conta, com ou sem @ e sem diferenciar maiúsculas",
      (await getBrandKitForInstagramHandle(organizationId, "@Cliente_B_QA")).brandKitId === copied.brandKitId &&
      (await getBrandKitForInstagramHandle(organizationId, "loja_matriz_qa")).brandKitId === null &&
      (await getBrandKitForInstagramHandle(organizationId, undefined)).brandKitId === null);
    check("CA-5", "palavra proibida só do kit do cliente é apontada só nos posts dele",
      hasForbiddenWordWarning(kitOfClientPost.forbiddenWords) && !hasForbiddenWordWarning(kitOfDefaultPost.forbiddenWords));

    const plannerOfPost = { forbiddenWords: ["grátis"] };
    const defaultRules = await getBrandChecklistRulesForPost({ organizationId, targetIgAccountId: defaultAccountId, planner: plannerOfPost });
    const clientRules = await getBrandChecklistRulesForPost({ organizationId, targetIgAccountId: clientAccountId, planner: plannerOfPost });
    check("CA-5", "no kit padrão, as palavras proibidas do planner do post continuam valendo; no kit do cliente, só as dele",
      defaultRules.forbiddenWords.includes("grátis") && defaultRules.forbiddenWords.includes("barato") &&
      clientRules.forbiddenWords.join() === "imbatível");

    const listed = await listBrandKits(organizationId);
    check("RF-6", "a lista mostra o padrão primeiro e quantas contas usam cada kit",
      listed.kits[0].isDefault && listed.kits[0].accountCount === 1 &&
      listed.kits.find((kit) => kit.brandKitId === copied.brandKitId)?.accountCount === 1);

    console.log("\nIsolamento entre empresas");
    check("CA-8", "outra empresa não lê, não grava, não renomeia e não apaga o kit",
      (await errorCodeOf(() => getBrandKit(otherOrganization.id, copied.brandKitId))) === "NOT_FOUND" &&
      (await errorCodeOf(() => saveBrandKitIdentity(otherOrganization.id, copied.brandKitId, { slogan: "invasão" }))) === "NOT_FOUND" &&
      (await errorCodeOf(() => addBrandKitAsset(otherOrganization.id, copied.brandKitId, { kind: "PRODUCT", title: "invasão" }))) === "NOT_FOUND" &&
      (await errorCodeOf(() => renameBrandKit(otherOrganization.id, copied.brandKitId, "Invadido"))) === "NOT_FOUND" &&
      (await errorCodeOf(() => deleteBrandKit(otherOrganization.id, copied.brandKitId))) === "NOT_FOUND");
    const otherKit = await createBrandKit({ organizationId: otherOrganization.id, name: "Kit da outra", shouldCopyDefault: false, createdById: "qa" });
    check("CA-8", "conta não pode ser vinculada a kit de outra empresa, nem por outra empresa",
      (await errorCodeOf(() => setInstagramAccountBrandKit(organizationId, defaultAccount.id, otherKit.brandKitId))) === "NOT_FOUND" &&
      (await errorCodeOf(() => setInstagramAccountBrandKit(otherOrganization.id, defaultAccount.id, otherKit.brandKitId))) === "NOT_FOUND" &&
      (await getBrandKitForPost({ organizationId, targetIgAccountId: defaultAccountId })).brandKitId === null);

    console.log("\nApagar kit");
    const deletion = await deleteBrandKit(organizationId, copied.brandKitId);
    const remainingClientAssets = await prisma.brandKitAsset.count({ where: { organizationId, brandKitId: copied.brandKitId } });
    check("CA-6", "apagar devolve as contas ao kit padrão e some com os materiais do kit",
      deletion.releasedAccountCount === 1 && deletion.removedAssetCount === 1 && remainingClientAssets === 0 &&
      (await getBrandKitForPost({ organizationId, targetIgAccountId: clientAccountId })).brandKitId === null);
    check("CA-6", "o kit padrão e seus materiais continuam intactos",
      (await getBrandKit(organizationId)).assets.map((asset) => asset.title).join() === "Produto da matriz");
    check("CB-8", "gravar num kit apagado devolve não encontrado",
      (await errorCodeOf(() => saveBrandKitIdentity(organizationId, copied.brandKitId, { slogan: "tarde demais" }))) === "NOT_FOUND");

    console.log("\nLimite de kits");
    for (let kitNumber = 1; kitNumber <= MAX_ADDITIONAL_BRAND_KITS; kitNumber += 1) {
      await createBrandKit({ organizationId, name: `Kit ${kitNumber}`, shouldCopyDefault: false, createdById: "qa" });
    }
    check("CA-12", `o ${MAX_ADDITIONAL_BRAND_KITS + 1}º kit adicional é recusado`,
      (await errorCodeOf(() => createBrandKit({ organizationId, name: "Kit excedente", shouldCopyDefault: false, createdById: "qa" }))) === "BAD_REQUEST" &&
      (await prisma.brandKit.count({ where: { organizationId } })) === MAX_ADDITIONAL_BRAND_KITS);
  } finally {
    // Cascade em Organization leva kits, materiais, contas e planners de teste.
    await prisma.organization.deleteMany({ where: { id: { in: [organization.id, otherOrganization.id] } } });
  }

  console.log(`\n${assertionCount - failures.length}/${assertionCount} asserções passaram.`);
  if (failures.length > 0) {
    console.log("Falhas:\n" + failures.map((failure) => `  - ${failure}`).join("\n"));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
