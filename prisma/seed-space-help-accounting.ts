/**
 * Seed — Space Help da aba Contábil (spec 0051).
 *
 * Artigos curtos na categoria "payment" (a aba Contábil mora dentro do
 * Payment). Idempotente: upsert por (categoria, slug) e passos recriados a
 * cada execução. Não mexe em nenhum outro artigo.
 *
 * Rode com:  pnpm tsx prisma/seed-space-help-accounting.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PAYMENT_CATEGORY = {
  slug: "payment",
  name: "Payment — Hub Financeiro",
  description: "Controle financeiro completo: contas, conciliação e relatórios.",
  iconKey: "payment",
  appId: "payment",
  order: 5,
};

/** Os artigos contábeis entram depois dos do financeiro. */
const FIRST_ORDER = 100;

interface HelpStep {
  title: string;
  description: string;
}

interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  steps: HelpStep[];
}

const ACCOUNTING_ARTICLES: HelpArticle[] = [
  {
    slug: "contabil-primeiros-passos",
    title: "Contábil: primeiros passos (perfil fiscal)",
    summary: "Diga ao sistema como sua empresa paga imposto. Tudo na aba Contábil parte daqui.",
    steps: [
      {
        title: "Abra a aba Contábil",
        description: "Em Payment, clique na aba Contábil (ícone de balança). Só quem tem acesso ao financeiro enxerga.",
      },
      {
        title: "Preencha o perfil fiscal",
        description:
          "Em Perfil fiscal, informe o regime (MEI, Simples Nacional, Lucro Presumido ou Real), o CNAE, o anexo do Simples, UF e município. Não sabe algum item? Passe o mouse no ⓘ ao lado: ele explica e mostra onde conferir.",
      },
      {
        title: "Folha e Fator R",
        description:
          "Se você presta serviço e tem folha (salários + pró-labore), informe a folha dos últimos 12 meses. Com ela o sistema calcula o Fator R, que pode baixar o seu imposto do Anexo V para o III.",
      },
      {
        title: "Telefones de aviso",
        description:
          "Cadastre os WhatsApps que devem receber os avisos de prazo. Os avisos também chegam no sino do NASA para os administradores.",
      },
      {
        title: "Conclua o cadastro",
        description:
          "Ao concluir, o calendário fiscal é montado e os avisos começam a rodar todo dia às 8h.",
      },
    ],
  },
  {
    slug: "contabil-apurar-e-gerar-guia",
    title: "Contábil: apurar o imposto e gerar a guia",
    summary: "O sistema calcula o imposto do mês a partir das receitas lançadas. Você confere e confirma.",
    steps: [
      {
        title: "Lance as receitas do mês",
        description:
          "O cálculo usa as contas a receber do financeiro, pela data de competência. Receita que não está lançada não entra no imposto.",
      },
      {
        title: "Clique em Apurar",
        description:
          "Em Apurações, escolha o mês e clique em Apurar. Você vê cada imposto com a memória de cálculo: RBT12, faixa, alíquota efetiva e a lei de onde veio cada número.",
      },
      {
        title: "Confira e confirme",
        description:
          "Confirmar gera a guia como conta a pagar no financeiro, com o vencimento certo. Enquanto não confirma, a apuração pode ser recalculada à vontade.",
      },
      {
        title: "Pague e dê baixa",
        description:
          "Ao dar baixa no pagamento da guia, a obrigação some do calendário e o score de regularidade sobe. Todo dia 10 o sistema lembra se a apuração do mês passado ainda não foi confirmada.",
      },
    ],
  },
  {
    slug: "contabil-documentos-e-score",
    title: "Contábil: documentos da empresa e score de regularidade",
    summary: "Guarde certidões, alvarás e certificado num lugar só e saiba se a empresa está em dia.",
    steps: [
      {
        title: "Veja o que a sua empresa precisa",
        description:
          "Em Documentos, a lista já vem filtrada pelo seu perfil. O que não se aplica você marca como \"não se aplica\" e sai da conta.",
      },
      {
        title: "Anexe com a validade",
        description:
          "Envie o PDF e informe a data de vencimento. Os arquivos ficam na pasta restrita \"Documentos da empresa\" do N-Box, que só administradores do financeiro veem.",
      },
      {
        title: "Entenda o score",
        description:
          "O score mostra quanto do que se aplica está em dia, com peso maior para o que trava licitação, nota ou crédito. Cada item pendente mostra quantos pontos devolve quando resolvido.",
      },
      {
        title: "Receba os avisos",
        description:
          "Documento vencendo avisa 30, 15 e 5 dias antes; vencido avisa no dia. Se o score cair 5 pontos ou mais na semana, você também é avisado.",
      },
    ],
  },
  {
    slug: "contabil-creditos-ibs-cbs",
    title: "Contábil: créditos de IBS e CBS",
    summary: "Na Reforma, o imposto das suas compras vira desconto no imposto das suas vendas.",
    steps: [
      {
        title: "Anexe o XML da nota de compra",
        description:
          "Na despesa, anexe o XML da nota do fornecedor. O sistema lê o IBS e a CBS destacados e cria o crédito.",
      },
      {
        title: "O crédito nasce quando você paga",
        description:
          "Pela LC 214/2025 o crédito só vale depois que a nota é paga. Até lá ele aparece como \"aguardando pagamento\"; ao dar baixa na despesa, fica disponível.",
      },
      {
        title: "Ele abate na apuração",
        description:
          "Os créditos disponíveis entram sozinhos na próxima apuração de CBS/IBS. Toda segunda você recebe o resumo das despesas pagas sem nota — cada uma é crédito perdido.",
      },
    ],
  },
  {
    slug: "contabil-precificacao",
    title: "Contábil: preço de venda com o imposto certo",
    summary: "Garanta que o preço cobre custo, imposto, comissão e a sua margem.",
    steps: [
      {
        title: "Classifique produtos e serviços",
        description:
          "Em Precificação, dê a cada item do Forge a classificação tributária (NCM ou NBS, item da LC 116 e cClassTrib). Ela define a alíquota e eventuais reduções da Reforma.",
      },
      {
        title: "Use a alíquota efetiva do seu perfil",
        description:
          "O simulador do Forge já abre com a alíquota efetiva calculada pelo seu regime e faturamento. A proposta passa a mostrar o imposto embutido no preço.",
      },
      {
        title: "Calcule pelo markup",
        description:
          "Na calculadora de markup, informe custo, imposto, comissão e margem desejada: ela devolve o preço mínimo e mostra a conta.",
      },
    ],
  },
  {
    slug: "contabil-calculadora",
    title: "Contábil: calculadoras fiscais",
    summary: "DAS, Fator R, Presumido, retenções, pró-labore, guia atrasada e mais — com a conta aberta.",
    steps: [
      {
        title: "Abra a calculadora",
        description:
          "Use a subaba Calculadora ou o botão flutuante da aba Contábil. Os campos já vêm preenchidos com os dados do seu perfil.",
      },
      {
        title: "Escolha o cálculo",
        description:
          "Estão agrupadas por tema: Simples e MEI, Presumido e comparativos, Reforma, preço de venda, folha e sócios, retenções e utilitárias.",
      },
      {
        title: "Leia a memória de cálculo",
        description:
          "Cada resultado mostra o passo a passo, a fórmula e a lei de onde veio. Nada é gravado: simule à vontade.",
      },
      {
        title: "Pergunte ao ASTRO",
        description:
          "Diga, por exemplo, \"quanto pago de DAS se faturar R$ 50 mil?\". O ASTRO usa as mesmas calculadoras e cita a base legal.",
      },
    ],
  },
  {
    slug: "contabil-reforma-tributaria",
    title: "Contábil: a Reforma Tributária para a sua empresa",
    summary: "O que muda de 2026 a 2033 e o que fazer em cada ano, de acordo com o seu regime.",
    steps: [
      {
        title: "Veja a linha do tempo",
        description:
          "Na subaba Reforma, cada ano mostra o que muda (CBS, IBS, fim de PIS/COFINS, ICMS e ISS) e as ações recomendadas para o seu regime.",
      },
      {
        title: "2026 é ano-teste",
        description:
          "CBS de 0,9% e IBS de 0,1% aparecem nas notas, mas quem cumpre as obrigações acessórias não recolhe. É hora de classificar produtos e ajustar o emissor de notas.",
      },
      {
        title: "Simples: dentro ou por fora do DAS",
        description:
          "A partir de 2027 o Simples pode recolher IBS/CBS por fora do DAS, o que gera crédito para clientes empresas. Simule os dois cenários antes de decidir.",
      },
      {
        title: "Valores estimados podem mudar",
        description:
          "Alíquotas marcadas como estimadas ainda serão fixadas pelo Senado. Decisões grandes, como trocar de regime, confirme com o seu contador.",
      },
    ],
  },
];

async function main() {
  console.log("🚀 Seed Space Help — Contábil…");

  const category = await prisma.spaceHelpCategory.upsert({
    where: { slug: PAYMENT_CATEGORY.slug },
    create: PAYMENT_CATEGORY,
    update: {},
  });

  let totalSteps = 0;
  for (const [index, article] of ACCOUNTING_ARTICLES.entries()) {
    const feature = await prisma.spaceHelpFeature.upsert({
      where: { categoryId_slug: { categoryId: category.id, slug: article.slug } },
      create: {
        categoryId: category.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        order: FIRST_ORDER + index,
      },
      update: { title: article.title, summary: article.summary, order: FIRST_ORDER + index },
    });

    await prisma.spaceHelpStep.deleteMany({ where: { featureId: feature.id } });
    await prisma.spaceHelpStep.createMany({
      data: article.steps.map((step, stepIndex) => ({
        featureId: feature.id,
        order: stepIndex,
        title: step.title,
        description: step.description,
      })),
    });
    totalSteps += article.steps.length;
  }

  console.log(`✓ ${ACCOUNTING_ARTICLES.length} artigos e ${totalSteps} passos da aba Contábil.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
