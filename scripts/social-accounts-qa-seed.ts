// Empresa de QA para conferir no navegador as telas da spec 0069 (contas do
// Instagram nos Satélites e seletor no Comments) sem depender da Meta: cria um
// usuário de teste, uma empresa e três contas falsas. Só para dev local.
//
//   pnpm tsx --conditions=react-server scripts/social-accounts-qa-seed.ts          # cria/atualiza
//   pnpm tsx --conditions=react-server scripts/social-accounts-qa-seed.ts --clean  # apaga tudo
//
// A senha do usuário de teste é gerada na primeira execução e fica em
// `.env.qa.local` (ignorado pelo git), nunca no repositório.

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import prisma from "../src/lib/prisma";
import { auth } from "../src/lib/auth";
import { tenantScope } from "../src/modules/shared/domain/tenant-scope";
import { createSocialRepositories } from "../src/modules/social";

const QA_ORG_SLUG = "social-accounts-qa";
const QA_ORG_NAME = "CONTAS QA";
const QA_OWNER_EMAIL = "owner.qa@social-accounts-qa.invalid";
const QA_OWNER_NAME = "Owner QA";
const QA_ENV_FILE = ".env.qa.local";
const QA_PASSWORD_KEY = "SOCIAL_ACCOUNTS_QA_PASSWORD";

const QA_ACCOUNTS = [
  { externalAccountId: "17841400000000001", handle: "loja_matriz", automationName: "Promoção da matriz", isDisabled: false },
  { externalAccountId: "17841400000000002", handle: "loja_filial", automationName: "Sorteio da filial", isDisabled: false },
  { externalAccountId: "17841400000000003", handle: "loja_antiga", automationName: null, isDisabled: true },
] as const;

function isLocalDatabase(): boolean {
  return /@(localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL ?? "");
}

function loadOrCreateQaPassword(): string {
  if (existsSync(QA_ENV_FILE)) {
    const storedLine = readFileSync(QA_ENV_FILE, "utf8")
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${QA_PASSWORD_KEY}=`));
    if (storedLine) return storedLine.slice(QA_PASSWORD_KEY.length + 1);
  }
  const generatedPassword = randomBytes(18).toString("base64url");
  writeFileSync(QA_ENV_FILE, `# Gerado por scripts/social-accounts-qa-seed.ts — só dev local.\nSOCIAL_ACCOUNTS_QA_EMAIL=${QA_OWNER_EMAIL}\n${QA_PASSWORD_KEY}=${generatedPassword}\n`);
  return generatedPassword;
}

async function clean() {
  await prisma.organization.deleteMany({ where: { slug: QA_ORG_SLUG } });
  await prisma.user.deleteMany({ where: { email: QA_OWNER_EMAIL } });
  console.log("Empresa e usuário de QA apagados.");
}

async function seed() {
  const password = loadOrCreateQaPassword();
  const authContext = await auth.$context;
  const passwordHash = await authContext.password.hash(password);

  const owner = await prisma.user.upsert({
    where: { email: QA_OWNER_EMAIL },
    create: { name: QA_OWNER_NAME, email: QA_OWNER_EMAIL, emailVerified: true },
    update: {},
    select: { id: true },
  });
  const credentialAccount = await prisma.account.findFirst({
    where: { userId: owner.id, providerId: "credential" },
    select: { id: true },
  });
  if (credentialAccount) {
    await prisma.account.update({ where: { id: credentialAccount.id }, data: { password: passwordHash } });
  } else {
    await prisma.account.create({
      data: {
        id: randomBytes(16).toString("hex"),
        userId: owner.id,
        providerId: "credential",
        accountId: owner.id,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  const organization = await prisma.organization.upsert({
    where: { slug: QA_ORG_SLUG },
    create: { name: QA_ORG_NAME, slug: QA_ORG_SLUG, createdAt: new Date() },
    update: {},
    select: { id: true },
  });
  await prisma.member.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: organization.id } },
    create: { organizationId: organization.id, userId: owner.id, role: "owner", createdAt: new Date() },
    update: { role: "owner" },
  });

  const { channels, automations } = createSocialRepositories(tenantScope(organization.id));
  for (const qaAccount of QA_ACCOUNTS) {
    const { channel } = await channels.connect({
      provider: "INSTAGRAM",
      externalAccountId: qaAccount.externalAccountId,
      handle: qaAccount.handle,
      displayName: qaAccount.handle,
      credentials: { accessToken: `token-falso-${qaAccount.handle}`, appSecret: "a".repeat(32), verifyToken: `verify-${qaAccount.handle}` },
      webhookPathToken: randomBytes(16).toString("hex"),
      connectedById: owner.id,
    });
    if (qaAccount.isDisabled) await channels.disconnect(channel.id);
    if (qaAccount.automationName && channel.automationCount === 0) {
      await automations.create({ channelId: channel.id, name: qaAccount.automationName, createdById: owner.id });
    }
  }

  console.log(`Empresa "${QA_ORG_NAME}" pronta com ${QA_ACCOUNTS.length} contas falsas.`);
  console.log(`Login: ${QA_OWNER_EMAIL} — a senha está em ${QA_ENV_FILE}.`);
}

async function main() {
  if (!isLocalDatabase()) throw new Error("Recusado: este script só roda contra o banco local.");
  if (process.argv.includes("--clean")) await clean();
  else await seed();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
