// Conferência da spec 0074 (mesmo conteúdo em várias contas do Instagram) contra o
// Postgres local. Não há runner de testes no projeto (CLAUDE.md, regra 20): cada
// CA-n / CB-n vira uma asserção aqui. Cria uma empresa e um usuário descartáveis
// e apaga tudo no fim. Programar de verdade (CA-9 a CA-11) depende do Inngest e de
// contas reais: fica no roteiro manual da spec.
//
//   pnpm tsx --conditions=react-server scripts/planner-publish-group-qa-check.ts

import "dotenv/config";
import { readFileSync } from "node:fs";
import prisma from "../src/lib/prisma";
import { tenantScope } from "../src/modules/shared/domain/tenant-scope";
import { createSocialRepositories } from "../src/modules/social";
import { ensureDefaultPlanner } from "../src/features/nasa-planner/server/cross-org";
import { CHOOSE_ACCOUNT_MESSAGE } from "../src/features/nasa-planner/server/publishing/instagram-channels";
import {
  approveWithGroup,
  createPostsForInstagramAccounts,
  getPublishGroupOverview,
  resolveInstagramAccountIdsByHandle,
  setPublishGroupAccounts,
  setPublishGroupDetached,
  submitForApprovalWithGroup,
  syncPublishGroupContent,
} from "../src/features/nasa-planner/server/publish-group";
import { schedulePlannerPost } from "../src/features/nasa-planner/server/scheduling";

const RUN_ID = `qa0074-${Date.now()}`;
const failures: string[] = [];
let assertionCount = 0;

function check(criterion: string, description: string, isOk: boolean) {
  assertionCount += 1;
  console.log(`  ${isOk ? "✅" : "❌"} ${criterion} — ${description}`);
  if (!isOk) failures.push(`${criterion} — ${description}`);
}

/** Toda procedure que grava conteúdo ou mídia precisa chamar a sincronia do grupo (spec 0074, D-2). */
const CONTENT_WRITERS = [
  "src/app/router/nasa-planner/update-post.ts",
  "src/app/router/nasa-planner/upload-post-image.ts",
  "src/app/router/nasa-planner/update-post-slide.ts",
  "src/app/router/nasa-planner/add-slides-batch.ts",
  "src/app/router/nasa-planner/remove-post-slide.ts",
  "src/app/router/nasa-planner/remove-post-media.ts",
  "src/app/router/nasa-planner/attach-video.ts",
  "src/app/router/nasa-planner/add-video-clip.ts",
  "src/app/router/nasa-planner/save-edited-video.ts",
  "src/app/router/nasa-planner/generate-post.ts",
  "src/app/router/nasa-planner/generate-image-from-prompt.ts",
  "src/app/router/nasa-planner/generate-image-from-reference.ts",
  "src/app/router/nasa-planner/generate-post-image.ts",
  "src/app/router/nasa-planner/generate-video-clip.ts",
  "src/features/external-ai/server/mcp/planner-mcp-tools.ts",
];

const rejects = (run: () => Promise<unknown>) => run().then(() => false).catch(() => true);

async function main() {
  const organization = await prisma.organization.create({
    data: { name: "QA 0074", slug: RUN_ID, createdAt: new Date() },
    select: { id: true },
  });
  const user = await prisma.user.create({ data: { name: "QA 0074", email: `${RUN_ID}@example.test` }, select: { id: true } });
  const organizationId = organization.id;
  const channels = createSocialRepositories(tenantScope(organizationId)).channels;
  const connectAccount = async (label: string) => {
    const { channel } = await channels.connect({
      provider: "INSTAGRAM",
      externalAccountId: `${RUN_ID}-${label}`,
      handle: `${RUN_ID}_${label}`,
      credentials: { accessToken: `token-${label}`, appSecret: "a".repeat(32), verifyToken: `verify-${label}` },
      webhookPathToken: `${RUN_ID}-${label}`,
    });
    return channel.externalAccountId;
  };

  try {
    const [accountA, accountB, accountC] = [await connectAccount("a"), await connectAccount("b"), await connectAccount("c")];
    const plannerId = await ensureDefaultPlanner(organizationId);
    const newPost = { organizationId, plannerId, createdById: user.id, type: "REEL" as const, title: "Reel de teste", caption: "Legenda original", hashtags: ["teste"], targetNetworks: ["INSTAGRAM", "FACEBOOK"], targetFbPageId: "pagina", videoKey: "video.mp4", videoDuration: 20 };
    const loadGroup = (publishGroupId: string) => prisma.nasaPlannerPost.findMany({ where: { publishGroupId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { slides: true } });

    console.log("\nCriação");
    const createdGroup = await createPostsForInstagramAccounts(newPost, [accountA, accountB, accountC]);
    const publishGroupId = createdGroup[0].publishGroupId!;
    check("CA-1", "3 contas criam 3 posts no mesmo grupo, um por conta, com o mesmo conteúdo",
      createdGroup.length === 3 && createdGroup.every((post) => post.publishGroupId === publishGroupId && post.caption === "Legenda original") &&
      createdGroup.map((post) => post.targetIgAccountId).join() === [accountA, accountB, accountC].join());
    check("CB-14", "só o primeiro irmão leva o Facebook",
      createdGroup[0].targetNetworks.includes("FACEBOOK") && createdGroup.slice(1).every((post) => !post.targetNetworks.includes("FACEBOOK") && post.targetFbPageId === null));
    const [singlePost] = await createPostsForInstagramAccounts({ ...newPost, title: "Post de uma conta" }, [accountA]);
    check("CA-2", "1 conta cria um post comum, sem grupo, com a conta gravada", singlePost.publishGroupId === null && singlePost.targetIgAccountId === accountA);
    check("CB-10", "conta repetida é recusada", await rejects(() => createPostsForInstagramAccounts(newPost, [accountA, accountA])));
    check("CB-11", "mais de 10 contas é recusado", await rejects(() => createPostsForInstagramAccounts(newPost, Array.from({ length: 11 }, (_, accountIndex) => `conta-${accountIndex}`))));
    check("CA-17", "conta que não é do cliente é recusada sem criar nada",
      (await rejects(() => createPostsForInstagramAccounts({ ...newPost, title: "Alheia" }, [accountA, "conta-de-outro-cliente"]))) &&
      (await prisma.nasaPlannerPost.count({ where: { organizationId, title: "Alheia" } })) === 0);
    check("CA-17", "o @ da conta vira o id que o post guarda; @ desconhecido é recusado",
      (await resolveInstagramAccountIdsByHandle(organizationId, [`@${RUN_ID}_b`]))[0] === accountB &&
      (await rejects(() => resolveInstagramAccountIdsByHandle(organizationId, ["nao_existe"]))));

    console.log("\nSincronia do conteúdo");
    const [postA, postB, postC] = createdGroup;
    await prisma.nasaPlannerPost.update({ where: { id: postA.id }, data: { caption: "Legenda nova", thumbnail: "capa.jpg" } });
    await prisma.nasaPlannerPostSlide.create({ data: { postId: postA.id, order: 1, imageKey: "slide-1.jpg" } });
    await syncPublishGroupContent(postA.id, user.id);
    let group = await loadGroup(publishGroupId);
    check("CA-3", "editar um irmão leva legenda, capa e slides aos outros",
      group.every((post) => post.caption === "Legenda nova" && post.thumbnail === "capa.jpg" && post.slides.length === 1 && post.slides[0].imageKey === "slide-1.jpg"));

    await setPublishGroupDetached({ postId: postC.id, isDetached: true, actorId: user.id });
    await prisma.nasaPlannerPost.update({ where: { id: postA.id }, data: { caption: "Legenda do grupo" } });
    await syncPublishGroupContent(postA.id, user.id);
    await prisma.nasaPlannerPost.update({ where: { id: postC.id }, data: { caption: "Legenda só da conta C" } });
    await syncPublishGroupContent(postC.id, user.id);
    group = await loadGroup(publishGroupId);
    check("CA-4", "irmão \"diferente nesta conta\" não recebe nem envia mudanças",
      group[0].caption === "Legenda do grupo" && group[1].caption === "Legenda do grupo" && group[2].caption === "Legenda só da conta C");
    await setPublishGroupDetached({ postId: postC.id, isDetached: false, actorId: user.id });
    check("RF-5", "voltar a sincronizar traz o conteúdo do grupo", (await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postC.id } })).caption === "Legenda do grupo");

    await prisma.nasaPlannerPost.update({ where: { id: postB.id }, data: { status: "PUBLISHED", publishedAt: new Date(), externalIgPostId: "midia-b" } });
    await prisma.nasaPlannerPost.update({ where: { id: postA.id }, data: { caption: "Legenda depois de publicar em B" } });
    await syncPublishGroupContent(postA.id, user.id);
    group = await loadGroup(publishGroupId);
    check("CA-5", "irmão publicado não muda com edição vinda do grupo", group[1].caption === "Legenda do grupo" && group[2].caption === "Legenda depois de publicar em B");

    console.log("\nAprovação por grupo");
    await submitForApprovalWithGroup({ postId: postA.id, actorId: user.id });
    group = await loadGroup(publishGroupId);
    check("CA-6", "enviar para aprovação leva os irmãos em rascunho; o publicado fica como está",
      group[0].status === "PENDING_APPROVAL" && group[2].status === "PENDING_APPROVAL" && group[1].status === "PUBLISHED");
    await approveWithGroup({ postId: postA.id, actorId: user.id });
    group = await loadGroup(publishGroupId);
    const approvalRows = await prisma.nasaPlannerPostReview.count({ where: { postId: { in: [postA.id, postC.id] }, kind: "APPROVED" } });
    check("CA-7", "aprovar aprova os irmãos e cada um ganha a sua linha no histórico",
      group[0].status === "APPROVED" && group[2].status === "APPROVED" && approvalRows === 2);

    await prisma.nasaPlannerPost.update({ where: { id: postA.id }, data: { caption: "Legenda editada depois de aprovada" } });
    await syncPublishGroupContent(postA.id, user.id);
    check("CB-3", "irmão aprovado que recebeu mudança volta a rascunho",
      (await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postC.id } })).status === "DRAFT");

    console.log("\nChecklist por conta");
    const kitOfB = await prisma.brandKit.create({ data: { organizationId, name: "Kit B", nameKey: "kit b", forbiddenWords: ["proibida"] }, select: { id: true } });
    await prisma.socialChannel.updateMany({ where: { organizationId, externalAccountId: accountB }, data: { brandKitId: kitOfB.id } });
    const checklistGroup = await createPostsForInstagramAccounts({ ...newPost, title: "Checklist", caption: "Uma palavra proibida aqui" }, [accountA, accountB]);
    const overview = await getPublishGroupOverview(checklistGroup[0].id);
    const warningsOf = (accountId: string) => overview.posts.find((post) => post.targetIgAccountId === accountId)?.checklist.filter((item) => item.status === "warn").length ?? -1;
    check("CA-8", "palavra proibida só no kit da conta B reprova só a conta B", warningsOf(accountA) === 0 && warningsOf(accountB) > 0);

    console.log("\nContas do grupo");
    const { postId: keptPostId } = await setPublishGroupAccounts({ postId: singlePost.id, instagramAccountIds: [accountA, accountB], actorId: user.id });
    const grownPost = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: singlePost.id } });
    const grownGroup = await loadGroup(grownPost.publishGroupId!);
    check("CA-13", "marcar mais uma conta cria o irmão com o mesmo conteúdo",
      keptPostId === singlePost.id && grownGroup.length === 2 && grownGroup[1].targetIgAccountId === accountB && grownGroup[1].title === "Post de uma conta");
    await setPublishGroupAccounts({ postId: singlePost.id, instagramAccountIds: [accountA], actorId: user.id });
    const shrunkPost = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: singlePost.id } });
    check("CA-13", "desmarcar apaga o irmão e o post original segue existindo", (await prisma.nasaPlannerPost.count({ where: { id: grownGroup[1].id } })) === 0);
    check("CB-8", "grupo com um post só volta a ser post comum", shrunkPost.publishGroupId === null);
    check("CB-9", "conta já publicada não pode sair do grupo",
      await rejects(() => setPublishGroupAccounts({ postId: postA.id, instagramAccountIds: [accountA, accountC], actorId: user.id })));

    console.log("\nConta conferida ao programar");
    const [postWithoutAccount] = await createPostsForInstagramAccounts({ ...newPost, title: "Sem conta", status: "APPROVED" }, []);
    const scheduleError = await schedulePlannerPost(postWithoutAccount.id, new Date(Date.now() + 3_600_000)).then(() => null).catch((error: Error) => error.message);
    check("CA-14", "post sem conta em cliente com várias contas é recusado ao programar, sem mudar de status",
      scheduleError === CHOOSE_ACCOUNT_MESSAGE && (await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postWithoutAccount.id } })).status === "APPROVED");

    console.log("\nSincronia ligada em toda escrita de conteúdo");
    for (const filePath of CONTENT_WRITERS) {
      check("D-2", `${filePath} chama a sincronia do grupo`, readFileSync(filePath, "utf8").includes("syncPublishGroupContent("));
    }
  } finally {
    // Cascade em Organization leva posts, contas e kits de teste.
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: user.id } });
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
