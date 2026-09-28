import "dotenv/config";
import { ASTRO_ACTIONS, getAstroAction } from "../src/features/astro/actions/registry";
import { runClassifiedAction } from "../src/features/astro/actions/run-classified-action";
import { ASTRO_QUERIES, runAstroQuery } from "../src/features/astro/queries/registry";
import {
  ALL_APPS,
  DEFAULT_PERMISSIONS,
  NASA_ROLES,
} from "../src/features/permissions/lib/catalog";
import { resolveOrgPermissions, isOrgActionAllowed } from "../src/features/permissions/server/resolve-org-permissions";
import prisma from "../src/lib/prisma";

/**
 * Spec 0027 — o Astro respeita a mesma matriz que a tela respeita.
 *
 * O teste que importa é o CA-2: não basta a recusa aparecer na tela, o
 * registro precisa continuar no banco. Recusa bonita com escrita executada é
 * pior que recusa nenhuma, porque engana quem confere.
 */

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} — ${detail}`);
  if (!ok) failures += 1;
}

const KNOWN_APP_KEYS = new Set(ALL_APPS.map((app) => app.key));

async function readStream(response: Response): Promise<string> {
  const body = await response.text();
  return body;
}

async function main(): Promise<void> {
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!organization) {
    console.error("Nenhuma organização no banco.");
    process.exit(1);
  }
  console.log(`Organização: ${organization.name}\n`);

  // ── CA-1 — nenhuma ação sem gate ────────────────────────────────────────
  const semGate = ASTRO_ACTIONS.filter((action) => !action.permission);
  check(
    "CA-1",
    semGate.length === 0,
    semGate.length === 0
      ? `${ASTRO_ACTIONS.length} ações declaram permissão`
      : `sem permissão: ${semGate.map((a) => a.key).join(", ")}`,
  );

  const appKeyInvalido = ASTRO_ACTIONS.filter(
    (action) => !KNOWN_APP_KEYS.has(action.permission.appKey),
  );
  check(
    "CA-1 catálogo",
    appKeyInvalido.length === 0,
    appKeyInvalido.length === 0
      ? "toda appKey existe no catálogo da tela"
      : `fora do catálogo: ${appKeyInvalido.map((a) => `${a.key}→${a.permission.appKey}`).join(", ")}`,
  );

  const queriesSemAppKey = ASTRO_QUERIES.filter(
    (query) => !query.appKey || !KNOWN_APP_KEYS.has(query.appKey),
  );
  check(
    "CA-1 consultas",
    queriesSemAppKey.length === 0,
    queriesSemAppKey.length === 0
      ? `${ASTRO_QUERIES.length} consultas declaram appKey válida`
      : `inválidas: ${queriesSemAppKey.map((q) => q.key).join(", ")}`,
  );

  // Exclusão nunca pode passar por create/edit.
  const destrutivasFracas = ASTRO_ACTIONS.filter(
    (action) =>
      (action.key.includes("delete") || action.key.includes("archive") || action.key.includes("cancel")) &&
      action.permission.action !== "delete",
  );
  check(
    "CA-1 destrutivas",
    destrutivasFracas.length === 0,
    destrutivasFracas.length === 0
      ? "toda ação destrutiva exige canDelete"
      : `com gate fraco: ${destrutivasFracas.map((a) => a.key).join(", ")}`,
  );

  // ── Matriz: o resolvedor bate com o padrão da role ──────────────────────
  const members = await prisma.member.findMany({
    where: { organizationId: organization.id },
    select: { userId: true, role: true, user: { select: { name: true } } },
  });
  const owner = members.find((member) => member.role === "owner");
  if (!owner) {
    console.error("Organização sem owner — nada a verificar.");
    process.exit(1);
  }

  const resolvedOwner = await resolveOrgPermissions(owner.userId, organization.id);
  check(
    "matriz do owner",
    isOrgActionAllowed(resolvedOwner, "tracking", "delete"),
    `owner ${owner.user?.name ?? ""} pode excluir em tracking`,
  );

  const estranho = await resolveOrgPermissions("nao-existe", organization.id);
  check(
    "não-membro não resolve",
    estranho === null,
    estranho === null ? "usuário de fora recebe null" : "resolveu para alguém de fora",
  );

  // A matriz pura, sem banco: é ela que a tela lê e que o gate precisa
  // reproduzir. Se este bloco quebrar, Astro e tela divergiram.
  for (const role of NASA_ROLES) {
    const padrao = DEFAULT_PERMISSIONS[role];
    const sintetico = { role, overrides: {}, fallback: padrao };
    const bate =
      isOrgActionAllowed(sintetico, "tracking", "view") === padrao.canView &&
      isOrgActionAllowed(sintetico, "tracking", "create") === padrao.canCreate &&
      isOrgActionAllowed(sintetico, "tracking", "edit") === padrao.canEdit &&
      isOrgActionAllowed(sintetico, "tracking", "delete") === padrao.canDelete;
    check(`matriz ${role}`, bate, `gate reproduz o padrão da role ${role}`);
  }

  // Override vence o padrão da role — é o que o Master configura na tela.
  const comOverride = {
    role: "owner",
    overrides: { tracking: { ...DEFAULT_PERMISSIONS.owner, canDelete: false } },
    fallback: DEFAULT_PERMISSIONS.owner,
  };
  check(
    "override revoga",
    !isOrgActionAllowed(comOverride, "tracking", "delete") &&
      isOrgActionAllowed(comOverride, "financeiro", "delete"),
    "owner sem canDelete em tracking perde só ali, o resto segue",
  );

  // ── CA-2 / CA-3 — recusa de verdade, com o registro intacto ─────────────
  const lead = await prisma.lead.findFirst({
    where: { tracking: { organizationId: organization.id } },
    select: { id: true, name: true },
  });

  // Quem NÃO pode excluir, sem criar usuário de teste: admin já tem
  // canDelete=false por padrão, e member também. Vale qualquer um que a
  // matriz negue — é ela que está sendo testada, não o papel.
  const semDelete: { userId: string; role: string } | undefined = await (async () => {
    for (const member of members) {
      const resolved = await resolveOrgPermissions(member.userId, organization.id);
      if (!isOrgActionAllowed(resolved, "tracking", "delete")) {
        return { userId: member.userId, role: member.role };
      }
    }
    return undefined;
  })();
  const membroSimples = semDelete;

  if (lead && membroSimples) {
    const deleteAction = getAstroAction("lead.delete")!;
    const run = await runClassifiedAction({
      ctx: {
        userId: membroSimples.userId,
        organizationId: organization.id,
        route: {},
        channel: "CHAT",
      } as never,
      classification: {
        app: "tracking",
        candidates: [
          { action: "lead.delete", confidence: 0.95, fields: { leadName: lead.name } },
        ],
        layer: "stage2",
        tokensUsed: 0,
        provider: "verify",
        modelId: "verify",
      } as never,
      userText: `apaga o lead ${lead.name}`,
    });
    const body = run ? await readStream(run.response) : "";

    check(
      "CA-2",
      run?.route === "denied",
      run ? `rota = ${run.route}` : "não devolveu resposta",
    );

    const aindaExiste = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { id: true },
    });
    check(
      "CA-2 banco",
      Boolean(aindaExiste),
      aindaExiste
        ? `"${lead.name}" continua no banco depois da recusa`
        : `⚠️ O LEAD FOI APAGADO apesar da recusa`,
    );

    check(
      "CA-3",
      /Quem libera é/.test(body) && /Permiss/.test(body),
      body.includes("Quem libera é")
        ? "a recusa diz a quem pedir"
        : `recusa sem responsável: ${body.slice(0, 120)}`,
    );

    check(
      "CA-3 apenas isso",
      !/canDelete|OrgPermission|prisma/i.test(body),
      "a recusa fala a língua do usuário, não a do banco",
    );

    void deleteAction;
  } else if (lead) {
    console.log(
      "[INFO] CA-2/CA-3 por role: todo membro desta org pode excluir — " +
        "o caminho da recusa é verificado abaixo com quem não é membro.",
    );
  }

  // Recusa ponta a ponta, sem depender da composição da org: quem não é
  // membro pede exclusão e o runner precisa parar ANTES do execute.
  if (lead) {
    const run = await runClassifiedAction({
      ctx: {
        userId: "nao-existe",
        organizationId: organization.id,
        route: {},
        channel: "CHAT",
      } as never,
      classification: {
        app: "tracking",
        candidates: [
          { action: "lead.delete", confidence: 0.95, fields: { leadName: lead.name } },
        ],
        layer: "stage2",
        tokensUsed: 0,
        provider: "verify",
        modelId: "verify",
      } as never,
      userText: `apaga o lead ${lead.name}`,
    });
    const body = run ? await readStream(run.response) : "";
    check(
      "CA-2 recusa",
      run?.route === "denied",
      run ? `rota = ${run.route}` : "não devolveu resposta",
    );
    const aindaExiste = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { id: true },
    });
    check(
      "CA-2 banco",
      Boolean(aindaExiste),
      aindaExiste
        ? `"${lead.name}" continua no banco depois da recusa`
        : "⚠️ O LEAD FOI APAGADO apesar da recusa",
    );
    check(
      "CA-3 linguagem",
      !/canDelete|OrgPermission|prisma|undefined/i.test(body),
      "a recusa fala a língua do usuário, não a do banco",
    );
  }

  // ── CA-4 — leitura do financeiro também passa pelo gate ─────────────────
  if (membroSimples) {
    const resolvedMembro = await resolveOrgPermissions(
      membroSimples.userId,
      organization.id,
    );
    const deveriaVer = isOrgActionAllowed(resolvedMembro, "financeiro", "view");
    const hit = await runAstroQuery({
      ctx: { userId: membroSimples.userId, organizationId: organization.id } as never,
      text: "quanto tenho a receber?",
    });
    check(
      "CA-4",
      deveriaVer ? hit !== null : hit === null,
      deveriaVer
        ? `${membroSimples.role} vê financeiro nesta org e recebeu resposta: ${hit !== null}`
        : `${membroSimples.role} sem canView não recebeu números: ${hit === null}`,
    );
  }

  // Usuário de fora nunca lê nada, independentemente da frase.
  const forasteiro = await runAstroQuery({
    ctx: { userId: "nao-existe", organizationId: organization.id } as never,
    text: "quantos leads temos?",
  });
  check(
    "CA-4 forasteiro",
    forasteiro === null,
    forasteiro === null ? "quem não é membro não lê nada" : `leu ${forasteiro.key}`,
  );

  console.log(`\n${failures} falha(s).`);
  await prisma.$disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main();
