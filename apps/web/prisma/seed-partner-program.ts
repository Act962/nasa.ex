/**
 * Seed do Programa NASA Partner
 *
 * Popula:
 *  1. PartnerProgramSettings (singleton com defaults dos tiers)
 *  2. SpaceHelpCategory "NASA Partner"
 *  3. SpaceHelpTrack "nasa-partner-regras" (não-gamificada — documentação obrigatória)
 *     com 8 lições cobrindo: programa, tiers, qualificação, comissões, responsabilidades,
 *     política de privacidade, LGPD, termo de aceite.
 *  4. PartnerTermsVersion v1.0.0 (ativa) com hash do conteúdo das lições.
 *
 * Rode com: npx tsx prisma/seed-partner-program.ts
 *
 * 100% idempotente — usa upsert por slug/version.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

// ─── Categoria Space Help ───────────────────────────────────────────────────
const PARTNER_CATEGORY = {
  slug: "nasa-partner",
  name: "NASA Partner",
  description:
    "Documentação oficial do programa de parceiros NASA — regras, qualificação, comissões, privacidade e LGPD.",
  iconKey: "handshake",
  appId: "partner",
  order: 99,
};

// ─── Trilha "NASA Partner — Regras, Privacidade e LGPD" ────────────────────
const PARTNER_TRACK = {
  slug: "nasa-partner-regras",
  title: "NASA Partner — Regras, Privacidade e LGPD",
  subtitle:
    "Tudo que você precisa saber para participar do programa de parceiros e tratar dados de empresas indicadas com responsabilidade.",
  description:
    "Esta trilha é obrigatória para todos os parceiros do programa NASA Partner. Aborda como o programa funciona, tiers, comissões, responsabilidades sobre dados das empresas indicadas, política de privacidade e conformidade com a LGPD. A leitura completa é exigida antes do primeiro aceite.",
  level: "obrigatorio",
  durationMin: 25,
  // Trilha NÃO-GAMIFICADA — sem stars/SP/selo. É documentação obrigatória.
  rewardStars: 0,
  rewardSpacePoints: 0,
  rewardBadgeSlug: null as string | null,
  order: 0,
};

const PARTNER_LESSONS = [
  {
    order: 0,
    title: "1. Como funciona o programa NASA Partner",
    summary:
      "Visão geral, link de indicação, registro de empresas e atribuição manual.",
    durationMin: 3,
    contentMd: `# 1. Como funciona o programa NASA Partner

## 1.1 Visão geral

O **NASA Partner** é o programa de parceria que recompensa quem traz novas empresas para a plataforma NASA. Funciona como uma camada acima do produto: todo usuário ganha um link único de indicação, e ao atingir 10 empresas indicadas que estejam efetivamente usando a plataforma, vira **Parceiro Suite** — com painel próprio (\`/partner\`), comissões em R$ sobre as compras de STARs feitas pelas empresas indicadas e desconto nas próprias compras de STARs.

## 1.2 Como obter seu link de indicação

Seu link é gerado automaticamente assim que você acessa o painel \`/home\` pela primeira vez. O formato é \`https://nasa.app/sign-up?ref=<seu-codigo>\`. O código é único e intransferível.

Você encontra o link no card "Seu link de indicação" no painel \`/home\` (e, depois de virar parceiro, também no painel \`/partner\`).

## 1.3 Como uma indicação é registrada

1. **Visita anônima** — quando alguém acessa seu link, registramos uma visita (anonimizada) e gravamos um cookie de 30 dias chamado \`nasa_ref\`.
2. **Cadastro com cookie ativo** — se a pessoa cria uma empresa em até 30 dias, o vínculo é registrado em \`PartnerReferral\` ligando o link à nova organização.
3. **Atribuição manual pelo admin** — em casos excepcionais (ex.: parceria comercial firmada offline), o administrador NASA pode vincular uma empresa existente a você. Isso fica auditado com o nome do admin e o motivo.

> **Auto-indicação não conta.** Você não pode indicar a si mesmo — o sistema bloqueia se o dono da nova empresa for o mesmo dono do link.
`,
  },
  {
    order: 1,
    title: "2. Tiers e benefícios",
    summary:
      "Critérios de qualificação, tabela de comissões/descontos e acesso vitalício.",
    durationMin: 4,
    contentMd: `# 2. Tiers e benefícios

## 2.1 Critérios de qualificação por tier

A qualificação é baseada em **empresas ATIVAS** — não basta cadastrar, a empresa precisa estar usando a plataforma (compras ou consumo de STARs nos últimos 90 dias). Veja a lição 3 sobre qualificação contínua.

## 2.2 Tabela de comissões e descontos

| Tier          | Empresas ativas | Comissão sobre R$ STARs | Desconto na compra das suas STARs | Bônus |
|---------------|-----------------|-------------------------|------------------------------------|-------|
| Suite         | 10–24           | 10%                     | 10%                                | —     |
| Earth         | 25–49           | 15%                     | 15%                                | —     |
| Galaxy        | 50–99           | 20%                     | 20%                                | —     |
| Constellation | 100–199         | 30%                     | 50%                                | —     |
| Infinity      | 200+            | 40%                     | 50%                                | Acesso vitalício |

Os limites podem ser ajustados pela administração — sempre consulte seu painel para os valores vigentes.

## 2.3 Acesso vitalício (Infinity)

Ao atingir o tier **Infinity** (200+ empresas ativas), o plano da sua organização principal passa a ser **gratuito enquanto você se mantiver no tier**. Se eventualmente cair de tier (após o período de carência), o plano volta a ser cobrado normalmente. Os créditos ganhos durante a vigência do Infinity ficam.

## 2.4 Como subir de tier

A subida de tier é **automática**. Sempre que o sistema recalcula sua quantidade de empresas ativas e você cruza um limiar, a promoção é imediata e fica registrada no histórico de tier (\`/partner/historico-tier\`).

> **Promoção manual pelo administrador.** O administrador pode te promover diretamente a um tier (ex.: "Galaxy" sem ter 50 ativas) — nesse caso, a promoção fica marcada como manual e você não cai abaixo do tier definido.
`,
  },
  {
    order: 2,
    title: "3. Qualificação contínua de empresas ativas",
    summary:
      "Janela de avaliação, estados ATIVA/EM RISCO/INATIVA e carência de downgrade.",
    durationMin: 4,
    contentMd: `# 3. Qualificação contínua

O programa premia parceiros que trazem empresas que **realmente usam** a plataforma. Cadastrar 30 empresas que nunca compram STARs não vai te qualificar para tier elevado.

## 3.1 O que é uma empresa "ativa"

Uma empresa indicada é considerada **ativa** se, dentro da janela de avaliação (90 dias por padrão), houve **pelo menos uma das condições**:

- Compra de STARs (qualquer valor por padrão; o admin pode definir mínimo cumulativo).
- Consumo de STARs (mínimo de 1 STAR cumulativo no período por padrão).

## 3.2 Janela de avaliação e cadência

- **Janela**: últimos 90 dias (configurável).
- **Cadência de recálculo**: diário (job automatizado roda toda madrugada). Eventos importantes (compra confirmada, consumo registrado, criação/exclusão de organização) também disparam recálculo imediato.

## 3.3 Estados ATIVA / EM RISCO / INATIVA

Cada empresa indicada tem um \`activityStatus\`:

- 🟢 **ATIVA** — cumpriu o critério na janela.
- 🟡 **EM RISCO** — tem alguma atividade, mas faltam ≤14 dias para sair da janela. Você recebe alerta para reativar.
- ⚫ **INATIVA** — nada qualifica na janela. **Não conta** para o tier.

A página \`/partner/indicacoes\` lista todas as empresas com filtro por status — use isso para priorizar quem você precisa reengajar.

## 3.4 Carência de downgrade

Se a sua quantidade de ativas cai abaixo do tier atual, o sistema **NÃO rebaixa imediatamente**. Inicia uma **carência de 30 dias** (configurável):

- Durante a carência, você mantém o tier atual e recebe a comissão correspondente.
- Você recebe avisos em T-7 e T-1 dia antes do fim da carência.
- Se você recuperar empresas ativas e voltar ao threshold antes da carência expirar, ela é **cancelada automaticamente**.
- Se a carência expirar sem recuperação, o downgrade efetiva e fica registrado no histórico de tier com o motivo \`grace_expired\`.

> **Importante:** durante a carência, a comissão das compras das suas indicadas é calculada com o **tier vigente** (não com o tier de destino). O snapshot por compra preserva esse cálculo mesmo se você cair depois.
`,
  },
  {
    order: 3,
    title: "4. Comissões e pagamentos",
    summary:
      "Cálculo com snapshot de preço, ciclo mensal, antecipação e estorno.",
    durationMin: 4,
    contentMd: `# 4. Comissões e pagamentos

## 4.1 Como a comissão é calculada (snapshot de preço)

Toda comissão é calculada **no momento em que o pagamento da empresa indicada é confirmado**, e fica gravada com **snapshot completo**:

- Pacote comprado (id e label)
- Quantidade de STARs
- Preço unitário (R$ por STAR) **naquele momento**
- Valor total pago
- Tier do parceiro **naquele momento**
- % de comissão **naquele momento**
- Valor da comissão em R$

> **Por que snapshot?** O preço dos pacotes pode mudar com o tempo. A comissão devida a você é a do momento da compra original — nunca recalculada com base no preço atual. Isso protege seu ganho e dá auditoria 100% rastreável.

## 4.2 Ciclo mensal e data de repasse

- **Ciclo aberto**: do dia 1 ao último dia do mês corrente. Comissões geradas ficam com status \`PENDING\`.
- **Fechamento**: dia 1 do mês seguinte às 00:05 — todas as comissões \`PENDING\` viram um único \`PartnerPayout\` com status \`SCHEDULED\`.
- **Repasse**: dia 10 (configurável) do mês seguinte. O administrador faz o pagamento e marca como \`PAID\` no painel admin.

## 4.3 Antecipação e taxa de redução

Você pode solicitar **antecipação** de um payout \`SCHEDULED\` mediante uma taxa de redução (5% por padrão, configurável). Restrições:

- O payout precisa estar com status \`SCHEDULED\`.
- A data oficial de repasse precisa estar a pelo menos 3 dias de distância (configurável).

Ao antecipar:
- \`grossBrl\` — valor bruto do payout
- \`advanceFeeBrl\` — taxa de antecipação (5% × bruto)
- \`netBrl\` — líquido a receber (bruto − taxa)

A operação é registrada e o status muda para \`ADVANCED\`.

## 4.4 Estorno e cancelamento

Se uma compra original da empresa indicada for **estornada** (refund pelo gateway), a comissão correspondente é automaticamente marcada como \`CANCELLED\`. Se ela ainda não foi paga, é debitada do seu saldo a receber. Se já foi paga, o ajuste fica para o ciclo seguinte.

Se uma empresa indicada for **excluída**, a comissão histórica permanece (já foi gerada), mas a empresa para de contar para o seu tier a partir do momento da exclusão.
`,
  },
  {
    order: 4,
    title: "5. Suas responsabilidades sobre dados das empresas indicadas",
    summary:
      "Confidencialidade, vedações de uso comercial, dever de reportar incidentes.",
    durationMin: 4,
    contentMd: `# 5. Responsabilidades do parceiro com dados das empresas

Como parceiro, você tem acesso a **dados sensíveis** das empresas que indicou — sabe quem comprou, quanto comprou, quanto consumiu, quando foi a última atividade. Esses dados são compartilhados com você **exclusivamente para fins do programa**.

## 5.1 Confidencialidade

Você se compromete a manter **estrita confidencialidade** sobre todos os dados das empresas indicadas. Isso inclui, mas não se limita a:

- Nome e CNPJ das empresas
- Valores gastos com STARs
- Padrão de consumo
- Datas de atividade
- Qualquer dado pessoal de membros das empresas

A obrigação de sigilo persiste mesmo após o encerramento da sua participação no programa.

## 5.2 Proibição de uso comercial dos dados visualizados

É **expressamente vedado**:

- Usar a lista de empresas indicadas para oferecer produtos/serviços próprios não relacionados à NASA.
- Vender, ceder ou compartilhar os dados com terceiros.
- Cruzar com bases externas para enriquecimento ou perfilamento.
- Replicar publicamente (mesmo de forma anonimizada) padrões agregados.

## 5.3 Vedação de contato direto não autorizado

Você **não deve** entrar em contato direto com membros das empresas indicadas usando os dados acessados via painel \`/partner\` para fins comerciais. Comunicação espontânea só é permitida se você **já tinha** o contato por outras vias legítimas (relacionamento prévio).

## 5.4 Dever de reportar incidentes de segurança

Se você suspeitar ou identificar **qualquer** incidente que possa comprometer dados das empresas indicadas (ex.: acesso indevido à sua conta, vazamento, perda de credenciais), reporte **em até 24h** ao suporte NASA via \`/partner/suporte\` ou pelo email **suporte@nasaagents.com**.

## 5.5 Sanções por violação

O descumprimento das obrigações desta seção pode resultar em:

- **Suspensão** imediata da conta de parceiro.
- **Cancelamento** de comissões pendentes não pagas.
- **Reversão** de comissões já pagas, mediante apuração do dano.
- **Acionamento judicial** em casos graves, especialmente em violações da LGPD.
`,
  },
  {
    order: 5,
    title: "6. Política de Privacidade aplicada ao Parceiro",
    summary:
      "Dados coletados, cookies de tracking, retenção e compartilhamento.",
    durationMin: 3,
    contentMd: `# 6. Política de Privacidade

## 6.1 Dados que coletamos do parceiro

Como parceiro do programa, coletamos e tratamos:

- **Identificação**: nome, email, telefone, dados da organização principal.
- **Dados financeiros**: chave Pix/dados bancários para repasse, histórico de comissões e pagamentos.
- **Dados de uso**: acessos ao painel \`/partner\`, eventos de cliques, IP de acesso.

A base legal para esse tratamento é **execução de contrato** (sua adesão ao programa) e **legítimo interesse** (auditoria e prevenção a fraudes).

## 6.2 Dados que coletamos das empresas indicadas

Sobre cada empresa indicada, registramos:

- **Vínculo**: data de cadastro, código de link (ou flag de atribuição manual).
- **Atividade**: timestamps e valores agregados de compras/consumo de STARs.
- **Status**: ATIVA / EM RISCO / INATIVA.

Esses dados são apresentados a você no painel \`/partner\` para que possa acompanhar suas comissões e priorizar reativação. **Você não vê dados pessoais de membros individuais** das empresas — apenas dados agregados da empresa.

## 6.3 Cookies e tracking de visitas

Quando alguém clica no seu link, criamos:

- Um registro anonimizado de **visita** (\`PartnerLinkVisit\`) com IP truncado e user-agent.
- Um cookie \`nasa_ref\` com seu código, válido por 30 dias.

O cookie é **httpOnly** (não acessível por JavaScript do navegador), **SameSite=Lax** e **Secure** em produção.

## 6.4 Retenção e descarte

- **Visitas anônimas que não convertem**: retidas por 90 dias e depois apagadas.
- **Indicações convertidas**: retidas enquanto o vínculo existir + 5 anos após o término do programa (para fins de auditoria fiscal).
- **Comissões e payouts**: retidos por **5 anos** (obrigação fiscal).
- **Aceites de termos**: retidos enquanto a conta existir + 5 anos.

## 6.5 Compartilhamento com terceiros

Compartilhamos dados estritamente necessários com:

- **Gateways de pagamento** (Stripe, Asaas) — apenas para processar repasses.
- **Provedor de email** — para notificações operacionais do programa.
- **Autoridades públicas** — quando legalmente requerido.

**Nunca** vendemos seus dados ou de empresas indicadas para terceiros.
`,
  },
  {
    order: 6,
    title: "7. LGPD — Lei Geral de Proteção de Dados",
    summary:
      "Papel do parceiro como operador, bases legais, direitos dos titulares.",
    durationMin: 4,
    contentMd: `# 7. LGPD — Lei Geral de Proteção de Dados

## 7.1 Papel do parceiro: operador (Art. 5º, VII LGPD)

Para fins da LGPD, no que diz respeito aos **dados das empresas indicadas que você visualiza no painel /partner**, você atua como **operador** dos dados — ou seja, trata dados pessoais sob orientação da NASA (controladora). Suas obrigações decorrem do Art. 39 da LGPD.

## 7.2 Bases legais para o tratamento

A NASA, como controladora, ampara o tratamento dos dados de empresas indicadas em:

- **Execução de contrato** (Art. 7º, V) — operacionalização do programa.
- **Legítimo interesse** (Art. 7º, IX) — apuração de comissões e auditoria.
- **Cumprimento de obrigação legal** (Art. 7º, II) — retenção fiscal.

## 7.3 Direitos dos titulares (Art. 18)

Os membros das empresas indicadas têm os seguintes direitos, que podem ser exercidos via NASA:

- Confirmação da existência de tratamento.
- Acesso aos dados.
- Correção de dados incompletos, inexatos ou desatualizados.
- Anonimização, bloqueio ou eliminação de dados desnecessários.
- Portabilidade.
- Eliminação dos dados tratados com consentimento.
- Informação sobre compartilhamentos.
- Revogação de consentimento.

Você, como parceiro, **deve repassar imediatamente à NASA** qualquer solicitação de exercício de direitos que receba de membros de empresas indicadas.

## 7.4 Dever de sigilo (Art. 47)

> "Os agentes de tratamento ou qualquer outra pessoa que intervenha em uma das fases do tratamento obriga-se a garantir a segurança da informação prevista nesta Lei em relação aos dados pessoais, mesmo após o seu término."

Esse dever **persiste indefinidamente**, mesmo após o término da sua participação no programa.

## 7.5 Como reportar incidente à NASA / ANPD

Se você identificar um incidente:

1. **Comunique a NASA em até 24h** via \`/partner/suporte\` ou \`suporte@nasaagents.com\`.
2. A NASA, como controladora, fará a comunicação à **ANPD** (Autoridade Nacional de Proteção de Dados) e aos titulares afetados quando aplicável (Art. 48 LGPD).
3. Você deve cooperar plenamente com a investigação interna, fornecendo logs, prints e qualquer evidência solicitada.

## 7.6 Penalidades em caso de descumprimento

Além das sanções contratuais previstas na lição 5.5, o descumprimento da LGPD por você pode resultar nas penalidades do **Art. 52 LGPD**, aplicáveis pela ANPD:

- Advertência.
- Multa de até **2% do faturamento**, limitada a R$ 50 milhões por infração.
- Bloqueio dos dados pessoais relacionados.
- Eliminação dos dados pessoais relacionados.
- Suspensão parcial ou proibição do exercício da atividade de tratamento.

A NASA cooperará com autoridades competentes em casos comprovados de violação.
`,
  },
  {
    order: 7,
    title: "8. Termo de aceite",
    summary:
      "Texto integral do termo. Ao aceitar, você confirma ter lido todas as seções acima.",
    durationMin: 3,
    contentMd: `# 8. Termo de aceite — NASA Partner v1.0.0

**Pelo presente instrumento**, eu, na qualidade de PARCEIRO do programa **NASA Partner**, declaro que:

1. **Li integralmente** as lições 1 a 7 desta trilha — incluindo regras do programa, qualificação, comissões, responsabilidades sobre dados, política de privacidade e LGPD.

2. **Compreendo** que o programa é regido pelos termos descritos nesta versão (v1.0.0) e que mudanças significativas exigirão novo aceite explícito da minha parte.

3. **Concordo** com a tabela de tiers, comissões, descontos e regras de qualificação contínua vigentes na data do meu aceite.

4. **Reconheço** que sou **operador** dos dados pessoais das empresas indicadas (Art. 5º, VII LGPD) e me comprometo a:
   - Manter **sigilo absoluto** sobre os dados acessados via painel \`/partner\`.
   - **Não usar** os dados para fins comerciais alheios ao programa.
   - **Não contatar** diretamente membros das empresas indicadas com base nos dados visualizados.
   - **Reportar** qualquer incidente de segurança em até 24h.

5. **Estou ciente** de que descumprimento das obrigações pode resultar em suspensão da conta, cancelamento/reversão de comissões e eventual responsabilização civil/criminal pela NASA e/ou pela ANPD.

6. **Autorizo** a NASA a:
   - Coletar e processar meus dados pessoais conforme a Política de Privacidade (lição 6).
   - Processar repasses via gateways autorizados (Stripe, Asaas).
   - Reter dados financeiros e de aceite por **5 anos** após o término do programa para fins fiscais e de auditoria.

7. **Reconheço** que ao clicar em **"Aceitar e continuar"** estou registrando aceite eletrônico válido nos termos do **Art. 219 do Código Civil** e do **Art. 7º, V da LGPD** — com captura de **IP, user-agent, timestamp e hash do conteúdo** desta versão para fins de auditoria.

---

> **Versão:** 1.0.0
> **Vigência:** a partir da data de publicação por administrador NASA.
> **Próxima revisão:** a critério da NASA, mediante aviso prévio e exigência de novo aceite.

**Ao aceitar, você confirma que leu, entendeu e concorda com todos os pontos acima.**
`,
  },
];

// ─── PartnerProgramSettings (singleton) ────────────────────────────────────
const PROGRAM_SETTINGS_DEFAULTS = {
  id: "singleton",
  suiteThreshold: 10,
  earthThreshold: 25,
  galaxyThreshold: 50,
  constellationThreshold: 100,
  infinityThreshold: 200,
  suiteCommissionRate: "10",
  earthCommissionRate: "15",
  galaxyCommissionRate: "20",
  constellationCommissionRate: "30",
  infinityCommissionRate: "40",
  suiteDiscountRate: "10",
  earthDiscountRate: "15",
  galaxyDiscountRate: "20",
  constellationDiscountRate: "50",
  infinityDiscountRate: "50",
  payoutDayOfMonth: 10,
  advanceFeePercent: "5",
  advanceMinDaysBefore: 3,
  activeOrgWindowDays: 90,
  activeOrgMinPurchaseBrl: "0",
  activeOrgMinStarsConsumed: 1,
  atRiskWarningDays: 14,
  downgradeGracePeriodDays: 30,
  tierRecalcCadenceDays: 1,
};

function computeContentHash(lessons: typeof PARTNER_LESSONS): string {
  const aggregated = lessons
    .map((l) => `${l.order}|${l.title}|${l.contentMd}`)
    .join("\n---\n");
  return createHash("sha256").update(aggregated, "utf8").digest("hex");
}

async function main() {
  console.log("\n🚀 Seed do Programa NASA Partner\n");

  // 1) PartnerProgramSettings (singleton)
  await prisma.partnerProgramSettings.upsert({
    where: { id: "singleton" },
    create: PROGRAM_SETTINGS_DEFAULTS as any,
    update: {}, // não sobrescreve se admin já editou
  });
  console.log("✓ PartnerProgramSettings (singleton) garantido.");

  // 2) Categoria Space Help
  const category = await prisma.spaceHelpCategory.upsert({
    where: { slug: PARTNER_CATEGORY.slug },
    create: PARTNER_CATEGORY,
    update: {
      name: PARTNER_CATEGORY.name,
      description: PARTNER_CATEGORY.description,
      iconKey: PARTNER_CATEGORY.iconKey,
      appId: PARTNER_CATEGORY.appId,
      order: PARTNER_CATEGORY.order,
    },
  });
  console.log(`✓ Categoria "${category.name}" garantida.`);

  // 3) Trilha + Lições
  const track = await prisma.spaceHelpTrack.upsert({
    where: { slug: PARTNER_TRACK.slug },
    create: {
      slug: PARTNER_TRACK.slug,
      title: PARTNER_TRACK.title,
      subtitle: PARTNER_TRACK.subtitle,
      description: PARTNER_TRACK.description,
      level: PARTNER_TRACK.level,
      durationMin: PARTNER_TRACK.durationMin,
      categoryId: category.id,
      rewardStars: PARTNER_TRACK.rewardStars,
      rewardSpacePoints: PARTNER_TRACK.rewardSpacePoints,
      order: PARTNER_TRACK.order,
    },
    update: {
      title: PARTNER_TRACK.title,
      subtitle: PARTNER_TRACK.subtitle,
      description: PARTNER_TRACK.description,
      level: PARTNER_TRACK.level,
      durationMin: PARTNER_TRACK.durationMin,
      categoryId: category.id,
      rewardStars: PARTNER_TRACK.rewardStars,
      rewardSpacePoints: PARTNER_TRACK.rewardSpacePoints,
      order: PARTNER_TRACK.order,
    },
  });

  // Reset de lições para reseed limpo (idempotente — se rodar duas vezes, conteúdo final é o mesmo).
  await prisma.spaceHelpLesson.deleteMany({ where: { trackId: track.id } });
  for (const lesson of PARTNER_LESSONS) {
    await prisma.spaceHelpLesson.create({
      data: {
        trackId: track.id,
        order: lesson.order,
        title: lesson.title,
        summary: lesson.summary,
        contentMd: lesson.contentMd,
        durationMin: lesson.durationMin,
      },
    });
  }
  console.log(
    `✓ Trilha "${track.title}" + ${PARTNER_LESSONS.length} lições gravadas.`,
  );

  // 4) PartnerTermsVersion v1.0.0
  const contentHash = computeContentHash(PARTNER_LESSONS);
  const existingV1 = await prisma.partnerTermsVersion.findUnique({
    where: { version: "1.0.0" },
  });

  if (!existingV1) {
    // Desativa qualquer versão ativa anterior (caso exista — defensivo)
    await prisma.partnerTermsVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    await prisma.partnerTermsVersion.create({
      data: {
        version: "1.0.0",
        title: "Termos NASA Partner v1.0",
        spaceHelpTrackId: track.id,
        contentHash,
        effectiveAt: new Date(),
        changeSummary: "Versão inicial do programa NASA Partner.",
        isActive: true,
      },
    });
    console.log(
      `✓ PartnerTermsVersion v1.0.0 publicada (hash ${contentHash.slice(0, 12)}...).`,
    );
  } else {
    // Atualiza apenas o vínculo com a trilha e o hash se o conteúdo mudou
    const needsUpdate =
      existingV1.contentHash !== contentHash ||
      existingV1.spaceHelpTrackId !== track.id;
    if (needsUpdate) {
      await prisma.partnerTermsVersion.update({
        where: { id: existingV1.id },
        data: {
          spaceHelpTrackId: track.id,
          contentHash,
        },
      });
      console.log(
        `✓ PartnerTermsVersion v1.0.0 atualizada (hash agora ${contentHash.slice(0, 12)}...).`,
      );
    } else {
      console.log("✓ PartnerTermsVersion v1.0.0 já existente — sem mudanças.");
    }
  }

  console.log("\n🎉 Seed do programa NASA Partner concluído.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
