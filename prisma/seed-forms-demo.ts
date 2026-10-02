/**
 * Formulários de demonstração para ver online (página pública /submit-form/<id>),
 * com blocos variados e respostas realistas.
 *
 *   pnpm tsx --conditions=react-server prisma/seed-forms-demo.ts               # cria na GOTHAN CODEX
 *   pnpm tsx --conditions=react-server prisma/seed-forms-demo.ts --org=<slug>  # outra empresa
 *   pnpm tsx --conditions=react-server prisma/seed-forms-demo.ts --cleanup     # remove tudo
 *
 * Tudo que o seed cria tem `shareUrl` começando com `demo-forms-`: é por ele que o --cleanup acha.
 */
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const DEMO_SHARE_PREFIX = "demo-forms-";
const DEFAULT_ORGANIZATION_SLUG = "gothan-codex";
const DAY_MS = 24 * 60 * 60 * 1000;

type BlockAttributes = Record<string, unknown>;
interface Block {
  id: string;
  blockType: string;
  attributes: BlockAttributes;
  isLocked?: boolean;
  childblocks?: Block[];
}
type FieldValue = { value: string };
type FieldAnswerer = (respondentIndex: number) => string;

function newBlockId() {
  return randomUUID().slice(0, 12);
}

function rowOf(...children: Block[]): Block {
  return { id: newBlockId(), blockType: "RowLayout", attributes: {}, isLocked: false, childblocks: children };
}

function headerRow(title: string, description: string): Block {
  return {
    id: newBlockId(),
    blockType: "RowLayout",
    attributes: {},
    isLocked: true,
    childblocks: [
      { id: newBlockId(), blockType: "Heading", attributes: { label: title, level: 1, fontSize: "4x-large", fontWeight: "normal" } },
      { id: newBlockId(), blockType: "Paragraph", attributes: { label: "Descrição", text: description, fontSize: "small", fontWeight: "normal" } },
    ],
  };
}

function field(blockType: string, attributes: BlockAttributes): Block {
  return { id: newBlockId(), blockType, attributes };
}

function optionsWithId(labels: string[]) {
  return labels.map((label) => ({ id: newBlockId(), label }));
}

function radioOptions(labels: string[]) {
  return labels.map((value) => ({ value, tagId: null }));
}

/** Sorteio determinístico: rodar duas vezes gera as mesmas respostas. */
function pickFrom<T>(items: T[], seed: number): T {
  return items[Math.abs(Math.floor(Math.sin(seed * 9301 + 49297) * 233280)) % items.length];
}

const PEOPLE = [
  ["Bruce Wayne", "bruce@wayne.com"],
  ["Selina Kyle", "selina@kylecat.com"],
  ["Lucius Fox", "lucius@waynetech.com"],
  ["Barbara Gordon", "barbara@oracle.net"],
  ["Harvey Dent", "harvey@gothamlaw.com"],
  ["Pamela Isley", "pamela@greengotham.com"],
  ["Alfred Pennyworth", "alfred@manor.uk"],
  ["Dick Grayson", "dick@flyinggraysons.com"],
  ["Leslie Thompkins", "leslie@clinic.org"],
  ["Edward Nygma", "ed@riddles.io"],
  ["Renee Montoya", "renee@gcpd.gov"],
  ["Kate Kane", "kate@kanecorp.com"],
] as const;

interface DemoFormDefinition {
  name: string;
  description: string;
  primaryColor: string;
  backgroundColor: string;
  finishMessage: string;
  views: number;
  responseCount: number;
  blocks: Block[];
  answers: Array<[Block, FieldAnswerer]>;
}

function buildDemoForms(): DemoFormDefinition[] {
  // 1. Pesquisa de satisfação
  const satisfactionStars = field("StarRating", { label: "De 1 a 5, quanto você está satisfeito com a ÓRBITA?", helperText: "", required: true, maxStars: 5 });
  const recommendation = field("RadioSelect", {
    label: "Você nos recomendaria para um amigo?",
    required: true,
    allowMultiple: false,
    options: radioOptions(["Com certeza", "Provavelmente sim", "Talvez", "Provavelmente não"]),
  });
  const bestFeature = field("Dropdown", {
    label: "Qual App você mais usa?",
    helperText: "",
    placeholder: "Escolha um App",
    required: false,
    options: optionsWithId(["Tracking", "Chat", "Agenda", "Forge", "Insights", "Workspace"]),
  });
  const improvement = field("TextArea", { label: "O que podemos melhorar?", helperText: "Fique à vontade, lemos todas.", required: false, placeHolder: "Sua sugestão…", rows: 4 });

  // 2. Orçamento de site
  const companyName = field("TextField", { label: "Nome da empresa", helperText: "", required: true, placeHolder: "Ex.: Wayne Enterprises" });
  const whatsapp = field("MaskedField", { label: "WhatsApp para contato", helperText: "Com DDD", required: true, placeHolder: "(11) 99999-9999", format: "phone-br", validateCep: false, validateCpf: false });
  const siteKind = field("Dropdown", {
    label: "Que tipo de site você precisa?",
    helperText: "",
    placeholder: "Selecione",
    required: true,
    options: optionsWithId(["Site institucional", "Loja virtual", "Landing page", "Blog", "Sistema sob medida"]),
  });
  const siteFeatures = field("Checkbox", {
    label: "Quais recursos são importantes?",
    helperText: "Pode marcar mais de um",
    required: false,
    multiple: true,
    options: optionsWithId(["Formulário de contato", "Integração com WhatsApp", "Blog", "Área do cliente", "Pagamento online", "Agenda online"]),
  });
  const deadline = field("RadioSelect", {
    label: "Para quando você precisa?",
    required: true,
    allowMultiple: false,
    options: radioOptions(["Até 15 dias", "Até 30 dias", "Até 60 dias", "Sem pressa"]),
  });
  const launchDate = field("DatePicker", { label: "Data ideal de lançamento", helperText: "", required: false, withTime: false, useAsDeadline: false });
  const projectDetails = field("TextArea", { label: "Conte um pouco do projeto", helperText: "", required: false, placeHolder: "Objetivo, público, referências…", rows: 5 });

  // 3. Inscrição em workshop
  const attendeeEmail = field("MaskedField", { label: "E-mail para receber o link", helperText: "", required: true, placeHolder: "voce@empresa.com", format: "email", validateCep: false, validateCpf: false });
  const experienceLevel = field("Dropdown", {
    label: "Seu nível em tráfego pago",
    helperText: "",
    placeholder: "Escolha",
    required: true,
    options: optionsWithId(["Nunca anunciei", "Iniciante", "Intermediário", "Avançado"]),
  });
  const shift = field("RadioSelect", {
    label: "Melhor turno para a aula ao vivo",
    required: true,
    allowMultiple: false,
    options: radioOptions(["Manhã", "Tarde", "Noite"]),
  });
  const workshopGoals = field("Checkbox", {
    label: "O que você quer aprender?",
    helperText: "",
    required: false,
    multiple: true,
    options: optionsWithId(["Meta Ads", "Google Ads", "Criativos que convertem", "Métricas e ROAS", "Remarketing"]),
  });
  const termsAccepted = field("Checkbox", {
    label: "Termos",
    helperText: "",
    required: true,
    multiple: false,
    options: optionsWithId(["Aceito receber os materiais do workshop por e-mail"]),
  });

  // 4. Feedback do atendimento
  const serviceStars = field("StarRating", { label: "Como foi o seu atendimento?", helperText: "", required: true, maxStars: 5 });
  const solvedProblem = field("RadioSelect", {
    label: "Seu problema foi resolvido?",
    required: true,
    allowMultiple: false,
    options: radioOptions(["Sim, totalmente", "Em parte", "Não"]),
  });
  const attendantName = field("TextField", { label: "Quem te atendeu? (opcional)", helperText: "", required: false, placeHolder: "Nome do atendente" });
  const serviceComment = field("TextArea", { label: "Quer deixar um comentário?", helperText: "", required: false, placeHolder: "", rows: 3 });

  // 5. Cadastro de cliente (onboarding)
  const tradeName = field("TextField", { label: "Nome fantasia", helperText: "", required: true, placeHolder: "Como seus clientes te conhecem" });
  const zipCode = field("MaskedField", { label: "CEP", helperText: "", required: true, placeHolder: "00000-000", format: "cep", validateCep: false, validateCpf: false });
  const segment = field("Dropdown", {
    label: "Segmento",
    helperText: "",
    placeholder: "Selecione",
    required: true,
    options: optionsWithId(["Saúde", "Educação", "Varejo", "Serviços", "Indústria", "Tecnologia"]),
  });
  const teamSize = field("RadioSelect", {
    label: "Tamanho da equipe",
    required: true,
    allowMultiple: false,
    options: radioOptions(["Só eu", "2 a 5 pessoas", "6 a 20 pessoas", "Mais de 20"]),
  });
  const channels = field("Checkbox", {
    label: "Por onde seus clientes chegam hoje?",
    helperText: "",
    required: false,
    multiple: true,
    options: optionsWithId(["Instagram", "WhatsApp", "Google", "Indicação", "Site", "Loja física"]),
  });
  const kickoffDate = field("DatePicker", { label: "Melhor dia para a reunião de início", helperText: "", required: false, withTime: false, useAsDeadline: false });

  const optionLabel = (block: Block, seed: number) =>
    pickFrom((block.attributes.options as Array<{ label: string }>).map((option) => option.label), seed);
  const radioValue = (block: Block, seed: number) =>
    pickFrom((block.attributes.options as Array<{ value: string }>).map((option) => option.value), seed);
  const severalLabels = (block: Block, seed: number) => {
    const labels = (block.attributes.options as Array<{ label: string }>).map((option) => option.label);
    return labels.filter((_, labelIndex) => (seed + labelIndex) % 3 !== 0).slice(0, 3).join(", ");
  };
  const dateInDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

  return [
    {
      name: "Pesquisa de satisfação",
      description: "Leva 1 minuto e nos ajuda a melhorar a ÓRBITA para você.",
      primaryColor: "#1447e6",
      backgroundColor: "#f5f8ff",
      finishMessage: "Obrigado! Sua opinião já chegou para o time.",
      views: 214,
      responseCount: 18,
      blocks: [
        headerRow("Pesquisa de satisfação", "Leva 1 minuto e nos ajuda a melhorar a ÓRBITA para você."),
        rowOf(satisfactionStars),
        rowOf(recommendation),
        rowOf(bestFeature),
        rowOf(improvement),
      ],
      answers: [
        [satisfactionStars, (seed) => String(pickFrom([5, 5, 4, 4, 5, 3], seed))],
        [recommendation, (seed) => radioValue(recommendation, seed)],
        [bestFeature, (seed) => optionLabel(bestFeature, seed + 3)],
        [improvement, (seed) => pickFrom(["Mais integrações com bancos.", "Relatórios por e-mail toda segunda.", "App para celular ainda mais rápido.", ""], seed)],
      ],
    },
    {
      name: "Orçamento de site",
      description: "Conte o que você precisa e enviamos uma proposta em até 24 horas.",
      primaryColor: "#0f766e",
      backgroundColor: "#f3fbf9",
      finishMessage: "Recebemos seu pedido! Em até 24 horas você recebe a proposta no WhatsApp.",
      views: 389,
      responseCount: 14,
      blocks: [
        headerRow("Orçamento de site", "Conte o que você precisa e enviamos uma proposta em até 24 horas."),
        rowOf(companyName),
        rowOf(whatsapp),
        rowOf(siteKind),
        rowOf(siteFeatures),
        rowOf(deadline),
        rowOf(launchDate),
        rowOf(projectDetails),
      ],
      answers: [
        [companyName, (seed) => pickFrom(["Wayne Enterprises", "Iceberg Lounge", "Gotham Gazette", "Ace Chemicals", "Kord Industries"], seed)],
        [whatsapp, (seed) => `(11) 9${String(8000 + seed * 37).padStart(4, "0")}-${String(1000 + seed * 53).slice(-4)}`],
        [siteKind, (seed) => optionLabel(siteKind, seed)],
        [siteFeatures, (seed) => severalLabels(siteFeatures, seed)],
        [deadline, (seed) => radioValue(deadline, seed + 1)],
        [launchDate, (seed) => dateInDays(15 + (seed % 5) * 7)],
        [projectDetails, (seed) => pickFrom(["Queremos vender online com entrega em toda a cidade.", "Site para captar leads para o time comercial.", "Precisamos de uma página para o lançamento do produto novo."], seed)],
      ],
    },
    {
      name: "Inscrição — Workshop de Tráfego Pago",
      description: "Aula ao vivo e gratuita. As vagas são limitadas.",
      primaryColor: "#7c3aed",
      backgroundColor: "#faf7ff",
      finishMessage: "Inscrição confirmada! O link da aula vai chegar no seu e-mail.",
      views: 642,
      responseCount: 20,
      blocks: [
        headerRow("Workshop de Tráfego Pago", "Aula ao vivo e gratuita. As vagas são limitadas."),
        rowOf(attendeeEmail),
        rowOf(experienceLevel),
        rowOf(shift),
        rowOf(workshopGoals),
        rowOf(termsAccepted),
      ],
      answers: [
        [attendeeEmail, (seed) => PEOPLE[seed % PEOPLE.length][1]],
        [experienceLevel, (seed) => optionLabel(experienceLevel, seed)],
        [shift, (seed) => radioValue(shift, seed)],
        [workshopGoals, (seed) => severalLabels(workshopGoals, seed)],
        [termsAccepted, () => "Aceito receber os materiais do workshop por e-mail"],
      ],
    },
    {
      name: "Feedback do atendimento",
      description: "Como foi falar com a gente? Sua resposta vai direto para o gestor.",
      primaryColor: "#ea580c",
      backgroundColor: "#fff8f3",
      finishMessage: "Valeu pelo retorno! Ele ajuda a gente a atender cada vez melhor.",
      views: 157,
      responseCount: 12,
      blocks: [
        headerRow("Feedback do atendimento", "Como foi falar com a gente? Sua resposta vai direto para o gestor."),
        rowOf(serviceStars),
        rowOf(solvedProblem),
        rowOf(attendantName),
        rowOf(serviceComment),
      ],
      answers: [
        [serviceStars, (seed) => String(pickFrom([5, 4, 5, 3, 5, 4, 2], seed))],
        [solvedProblem, (seed) => radioValue(solvedProblem, seed)],
        [attendantName, (seed) => pickFrom(["Alfred", "Lucius", "Barbara", ""], seed)],
        [serviceComment, (seed) => pickFrom(["Atendimento rápido e educado.", "Resolveu na primeira mensagem!", "Demorou um pouco para responder.", ""], seed)],
      ],
    },
    {
      name: "Cadastro de cliente",
      description: "Bem-vindo! Precisamos de alguns dados para começar o seu projeto.",
      primaryColor: "#0284c7",
      backgroundColor: "#f4faff",
      finishMessage: "Tudo certo! Seu gerente de conta vai te chamar para a reunião de início.",
      views: 96,
      responseCount: 9,
      blocks: [
        headerRow("Cadastro de cliente", "Bem-vindo! Precisamos de alguns dados para começar o seu projeto."),
        rowOf(tradeName),
        rowOf(zipCode),
        rowOf(segment),
        rowOf(teamSize),
        rowOf(channels),
        rowOf(kickoffDate),
      ],
      answers: [
        [tradeName, (seed) => pickFrom(["Clínica Thompkins", "Escola Grayson", "Ateliê Kyle", "Fox Tech", "Montoya Serviços"], seed)],
        [zipCode, (seed) => `0${1000 + seed * 41}-${String(100 + seed * 7).slice(-3)}`],
        [segment, (seed) => optionLabel(segment, seed)],
        [teamSize, (seed) => radioValue(teamSize, seed)],
        [channels, (seed) => severalLabels(channels, seed)],
        [kickoffDate, (seed) => dateInDays(3 + (seed % 4) * 2)],
      ],
    },
  ];
}

async function cleanup() {
  const prisma = (await import("../src/lib/prisma")).default;
  const demoForms = await prisma.form.findMany({ where: { shareUrl: { startsWith: DEMO_SHARE_PREFIX } }, select: { id: true } });
  const formIds = demoForms.map((form) => form.id);
  if (formIds.length === 0) {
    console.log("Nenhum formulário de demonstração para remover.");
    return;
  }
  await prisma.formResponses.deleteMany({ where: { formId: { in: formIds } } });
  await prisma.formSettings.deleteMany({ where: { formId: { in: formIds } } });
  await prisma.form.deleteMany({ where: { id: { in: formIds } } });
  console.log(`Removidos ${formIds.length} formulários de demonstração (e suas respostas).`);
}

async function seed(organizationSlug: string) {
  const prisma = (await import("../src/lib/prisma")).default;
  const organization = await prisma.organization.findFirst({ where: { slug: organizationSlug }, select: { id: true, name: true } });
  if (!organization) throw new Error(`Empresa "${organizationSlug}" não encontrada.`);

  const owner = await prisma.member.findFirst({
    where: { organizationId: organization.id, role: { in: ["owner", "admin"] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!owner) throw new Error("A empresa não tem dono/admin para assinar os formulários.");

  const tracking = await prisma.tracking.findFirst({
    where: { organizationId: organization.id, isArchived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, status: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
  });

  await cleanup();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const publicLinks: string[] = [];
  for (const [formIndex, definition] of buildDemoForms().entries()) {
    const jsonBlock = JSON.stringify(definition.blocks);
    const createdAt = new Date(Date.now() - (20 - formIndex * 3) * DAY_MS);
    const form = await prisma.form.create({
      data: {
        name: definition.name,
        description: definition.description,
        userId: owner.userId,
        organizationId: organization.id,
        jsonBlock,
        content: jsonBlock,
        published: true,
        views: definition.views,
        responses: definition.responseCount,
        shareUrl: `${DEMO_SHARE_PREFIX}${randomUUID()}`,
        createdAt,
        settings: {
          create: {
            primaryColor: definition.primaryColor,
            backgroundColor: definition.backgroundColor,
            finishMessage: definition.finishMessage,
            ...(tracking && { trackingId: tracking.id }),
            ...(tracking?.status[0] && { statusId: tracking.status[0].id }),
          },
        },
      },
      select: { id: true },
    });

    const responseRows = Array.from({ length: definition.responseCount }, (_, respondentIndex) => {
      const [personName, personEmail] = PEOPLE[(respondentIndex + formIndex * 3) % PEOPLE.length];
      const answeredAt = new Date(createdAt.getTime() + ((respondentIndex + 1) / (definition.responseCount + 1)) * (Date.now() - createdAt.getTime()));
      const fieldValues: Record<string, FieldValue | string> = {};
      for (const [block, answer] of definition.answers) {
        const value = answer(respondentIndex + formIndex * 7);
        if (value) fieldValues[block.id] = { value };
      }
      fieldValues.user_name = personName;
      fieldValues.user_email = personEmail;
      fieldValues.user_phone = `+55 11 9${String(7000 + respondentIndex * 131).slice(-4)}-${String(2000 + respondentIndex * 89).slice(-4)}`;
      return {
        formId: form.id,
        createdAt: answeredAt,
        completedAt: new Date(answeredAt.getTime() + (2 + (respondentIndex % 5)) * 60 * 1000),
        jsonResponse: JSON.stringify(fieldValues),
      };
    });
    await prisma.formResponses.createMany({ data: responseRows });
    publicLinks.push(`${definition.name.padEnd(38)} ${appUrl}/submit-form/${form.id}`);
  }

  console.log(`\n${organization.name}: ${publicLinks.length} formulários publicados${tracking ? ` (leads caem no tracking "${tracking.name}")` : ""}.\n`);
  for (const publicLink of publicLinks) console.log(`  ${publicLink}`);
  console.log("\nPara remover: pnpm tsx --conditions=react-server prisma/seed-forms-demo.ts --cleanup\n");
}

async function main() {
  const isCleanup = process.argv.includes("--cleanup");
  const organizationArgument = process.argv.find((argument) => argument.startsWith("--org="));
  if (isCleanup) await cleanup();
  else await seed(organizationArgument?.slice("--org=".length) || DEFAULT_ORGANIZATION_SLUG);
  process.exit(0);
}

main().catch((seedError) => {
  console.error(seedError);
  process.exit(1);
});
