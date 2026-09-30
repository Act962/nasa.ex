// Glossário fiscal: fonte única das explicações mostradas no ícone ⓘ, no
// ASTRO e no Space Help. Linguagem de dono de empresa, não de contador.
// Links conferidos em `lastVerifiedAt`; itens com `needsVerification`
// aparecem com aviso até alguém confirmar na fonte.

export interface GlossaryLink {
  label: string;
  url: string;
  lastVerifiedAt: string;
  needsVerification?: boolean;
}

export interface GlossaryTerm {
  id: string;
  label: string;
  plainExplanation: string;
  example?: string;
  legalBasis?: string;
  links: GlossaryLink[];
  astroPrompt: string;
}

const VERIFIED_AT = "2026-09-29";

export const OFFICIAL_LINKS = {
  lc214: { label: "LC 214/2025 (Reforma Tributária)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm", lastVerifiedAt: VERIFIED_AT },
  ec132: { label: "EC 132/2023", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm", lastVerifiedAt: VERIFIED_AT },
  lc123: { label: "LC 123/2006 (Simples Nacional)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm", lastVerifiedAt: VERIFIED_AT },
  lc116: { label: "LC 116/2003 (ISS)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm", lastVerifiedAt: VERIFIED_AT },
  simplesPortal: { label: "Portal do Simples Nacional", url: "https://www8.receita.fazenda.gov.br/simplesnacional/", lastVerifiedAt: VERIFIED_AT },
  meiPortal: { label: "Portal do Empreendedor (MEI)", url: "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor", lastVerifiedAt: VERIFIED_AT },
  nfseNacional: { label: "NFS-e Nacional", url: "https://www.gov.br/nfse/pt-br", lastVerifiedAt: VERIFIED_AT },
  reformaFazenda: { label: "Reforma Tributária — Ministério da Fazenda", url: "https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria", lastVerifiedAt: VERIFIED_AT },
  nfePortal: { label: "Portal da NF-e (notas técnicas)", url: "https://www.nfe.fazenda.gov.br/portal/", lastVerifiedAt: VERIFIED_AT },
  ecac: { label: "e-CAC (Receita Federal)", url: "https://cav.receita.fazenda.gov.br/", lastVerifiedAt: VERIFIED_AT },
  sefazPi: { label: "SEFAZ Piauí", url: "https://portal.sefaz.pi.gov.br/", lastVerifiedAt: VERIFIED_AT, needsVerification: true },
  semfTeresina: { label: "SEMF Teresina (ISS/NFS-e)", url: "https://semf.teresina.pi.gov.br/", lastVerifiedAt: VERIFIED_AT, needsVerification: true },
  cndFederal: { label: "Certidão Federal (Receita/PGFN)", url: "https://servicos.receitafederal.gov.br/servico/certidoes/", lastVerifiedAt: VERIFIED_AT },
  crfFgts: { label: "CRF do FGTS (Caixa)", url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf", lastVerifiedAt: VERIFIED_AT },
  cndt: { label: "CNDT (TST)", url: "https://cndt-certidao.tst.jus.br/inicio.faces", lastVerifiedAt: VERIFIED_AT },
  cnpjCard: { label: "Comprovante de CNPJ", url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp", lastVerifiedAt: VERIFIED_AT },
  jucepi: { label: "JUCEPI", url: "https://www.jucepi.pi.gov.br/", lastVerifiedAt: VERIFIED_AT, needsVerification: true },
  fgtsDigital: { label: "FGTS Digital", url: "https://fgtsdigital.sistema.gov.br/", lastVerifiedAt: VERIFIED_AT },
  esocial: { label: "eSocial", url: "https://www.gov.br/esocial/pt-br", lastVerifiedAt: VERIFIED_AT },
  selicReceita: { label: "Taxa de juros Selic (Receita)", url: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/taxa-de-juros-selic", lastVerifiedAt: VERIFIED_AT },
} satisfies Record<string, GlossaryLink>;

function term(definition: Omit<GlossaryTerm, "astroPrompt"> & { astroPrompt?: string }): GlossaryTerm {
  return {
    ...definition,
    astroPrompt:
      definition.astroPrompt ??
      `Explique de forma simples o que é "${definition.label}" para a minha empresa, com um exemplo usando os meus números e a base legal.`,
  };
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  term({
    id: "das",
    label: "DAS",
    plainExplanation: "Guia única do Simples Nacional. Junta vários impostos (IRPJ, CSLL, PIS, COFINS, CPP, ICMS/ISS) num boleto só, que vence todo dia 20.",
    example: "Receita de R$ 30 mil no mês com alíquota efetiva de 8% → DAS de R$ 2.400.",
    legalBasis: "LC 123/2006, art. 13 e art. 21",
    links: [OFFICIAL_LINKS.simplesPortal, OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "das-mei",
    label: "DAS-MEI",
    plainExplanation: "Valor fixo que o MEI paga todo mês, não importa quanto faturou: 5% do salário mínimo de INSS + R$ 1 de ICMS e/ou R$ 5 de ISS.",
    legalBasis: "LC 123/2006, art. 18-A",
    links: [OFFICIAL_LINKS.meiPortal],
  }),
  term({
    id: "mei",
    label: "MEI",
    plainExplanation: "Microempreendedor Individual: quem fatura até R$ 81 mil por ano e pode ter 1 funcionário. Paga um valor fixo mensal.",
    legalBasis: "LC 123/2006, art. 18-A",
    links: [OFFICIAL_LINKS.meiPortal],
  }),
  term({
    id: "simples-nacional",
    label: "Simples Nacional",
    plainExplanation: "Regime para empresas que faturam até R$ 4,8 milhões por ano. Os impostos são pagos numa guia só (DAS), com alíquota que cresce conforme o faturamento.",
    legalBasis: "LC 123/2006",
    links: [OFFICIAL_LINKS.simplesPortal, OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "lucro-presumido",
    label: "Lucro Presumido",
    plainExplanation: "Regime em que a Receita 'presume' que o lucro é uma porcentagem do faturamento (32% para serviços, 8% para comércio no IRPJ) e cobra IRPJ e CSLL sobre isso, por trimestre.",
    example: "Faturou R$ 100 mil no trimestre em serviços → base de R$ 32 mil → IRPJ 15% = R$ 4.800 e CSLL 9% = R$ 2.880.",
    legalBasis: "Lei 9.249/1995, arts. 15 e 20",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "lucro-real",
    label: "Lucro Real",
    plainExplanation: "Regime em que o imposto de renda é calculado sobre o lucro de verdade, apurado pela contabilidade. Obrigatório acima de R$ 78 milhões por ano e para alguns setores.",
    legalBasis: "Lei 9.718/1998, art. 14",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "rbt12",
    label: "RBT12",
    plainExplanation: "Receita bruta dos últimos 12 meses, sem contar o mês atual. É ela que define em qual faixa do Simples você está.",
    example: "Para o DAS de setembro, soma-se a receita de setembro do ano passado até agosto deste ano.",
    legalBasis: "LC 123/2006, art. 18 §1º",
    links: [OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "receita-bruta",
    label: "Receita bruta",
    plainExplanation: "Tudo o que a empresa vendeu no período (produtos e serviços), antes de descontar custos. Vendas canceladas e descontos incondicionais saem.",
    legalBasis: "LC 123/2006, art. 3º §1º",
    links: [OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "anexo-simples",
    label: "Anexo do Simples",
    plainExplanation: "Tabela de alíquotas conforme a atividade: I comércio, II indústria, III e V serviços (depende do Fator R), IV serviços como obras, limpeza e advocacia.",
    legalBasis: "LC 123/2006, Anexos I a V",
    links: [OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "fator-r",
    label: "Fator R",
    plainExplanation: "Folha de pagamento dos últimos 12 meses dividida pelo RBT12. Se der 28% ou mais, certos serviços pagam pelo Anexo III (mais barato) em vez do V.",
    example: "RBT12 de R$ 600 mil e folha de R$ 180 mil → Fator R de 30% → Anexo III.",
    legalBasis: "LC 123/2006, art. 18 §5º-J e §5º-M",
    links: [OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "folha-12-meses",
    label: "Folha dos últimos 12 meses",
    plainExplanation: "Soma de salários, pró-labore, FGTS e INSS patronal pagos nos 12 meses anteriores. Entra no cálculo do Fator R.",
    legalBasis: "LC 123/2006, art. 18 §24",
    links: [OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "aliquota-efetiva",
    label: "Alíquota efetiva",
    plainExplanation: "A porcentagem que você paga de verdade sobre o faturamento. No Simples é menor que a da tabela porque desconta a 'parcela a deduzir'.",
    example: "Faixa com 11,2% e dedução de R$ 9.360 em RBT12 de R$ 300 mil → (300.000 × 11,2% − 9.360) ÷ 300.000 = 8,08%.",
    legalBasis: "LC 123/2006, art. 18 §1º-A",
    links: [OFFICIAL_LINKS.lc123],
  }),
  term({
    id: "cnae",
    label: "CNAE",
    plainExplanation: "Código que diz qual é a atividade da empresa. Ele define o anexo do Simples, se precisa de alvará especial e o ISS.",
    links: [OFFICIAL_LINKS.cnpjCard],
  }),
  term({
    id: "iss",
    label: "ISS",
    plainExplanation: "Imposto municipal sobre serviços, de 2% a 5% conforme o serviço e a cidade. Em Teresina é pago à SEMF. Deixa de existir em 2033.",
    legalBasis: "LC 116/2003",
    links: [OFFICIAL_LINKS.lc116, OFFICIAL_LINKS.semfTeresina],
  }),
  term({
    id: "icms",
    label: "ICMS",
    plainExplanation: "Imposto estadual sobre venda de mercadorias, transporte e comunicação. No Piauí é administrado pela SEFAZ-PI. Deixa de existir em 2033.",
    links: [OFFICIAL_LINKS.sefazPi],
  }),
  term({
    id: "pis-cofins",
    label: "PIS/COFINS",
    plainExplanation: "Contribuições federais sobre o faturamento. No Presumido são cumulativas (0,65% + 3%); no Real, não cumulativas (1,65% + 7,6%, com créditos). Acabam em 2027, substituídas pela CBS.",
    legalBasis: "Leis 9.718/1998, 10.637/2002 e 10.833/2003",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "cbs",
    label: "CBS",
    plainExplanation: "Contribuição sobre Bens e Serviços, federal, que substitui PIS/COFINS. Em 2026 é teste (0,9%); a partir de 2027 entra com alíquota cheia. Gera crédito nas compras.",
    legalBasis: "EC 132/2023; LC 214/2025",
    links: [OFFICIAL_LINKS.lc214, OFFICIAL_LINKS.reformaFazenda],
  }),
  term({
    id: "ibs",
    label: "IBS",
    plainExplanation: "Imposto sobre Bens e Serviços, de estados e municípios, que substitui ICMS e ISS aos poucos entre 2029 e 2033. Também gera crédito nas compras.",
    legalBasis: "EC 132/2023; LC 214/2025",
    links: [OFFICIAL_LINKS.lc214, OFFICIAL_LINKS.reformaFazenda],
  }),
  term({
    id: "is",
    label: "Imposto Seletivo (IS)",
    plainExplanation: "Imposto extra sobre produtos prejudiciais à saúde ou ao meio ambiente (cigarro, bebida alcoólica, bebida açucarada, veículos, mineração). Começa em 2027.",
    legalBasis: "LC 214/2025, arts. 409 e seguintes",
    links: [OFFICIAL_LINKS.lc214],
  }),
  term({
    id: "cclasstrib",
    label: "cClassTrib",
    plainExplanation: "Código de classificação tributária do IBS/CBS que vai em cada item da nota. Diz se o item paga alíquota cheia, tem redução de 30%, 60% ou é isento.",
    example: "Serviços de saúde e educação têm redução de 60%.",
    legalBasis: "LC 214/2025, arts. 127 a 138; tabela de cClassTrib do Portal da NF-e",
    links: [OFFICIAL_LINKS.nfePortal, OFFICIAL_LINKS.lc214],
  }),
  term({
    id: "cst-ibs-cbs",
    label: "CST do IBS/CBS",
    plainExplanation: "Código de situação tributária que vai em cada item da nota e diz se ele é tributado normalmente, com redução, isento, suspenso ou com diferimento.",
    legalBasis: "LC 214/2025; tabela de CST/cClassTrib do Portal da NF-e",
    links: [OFFICIAL_LINKS.nfePortal],
  }),
  term({
    id: "glosa",
    label: "Crédito glosado",
    plainExplanation: "Crédito que não pode mais ser usado: a compra foi cancelada, não foi paga ou a nota tinha erro. Ele sai do saldo de créditos disponíveis.",
    legalBasis: "LC 214/2025, art. 47",
    links: [OFFICIAL_LINKS.lc214],
  }),
  term({
    id: "ncm",
    label: "NCM",
    plainExplanation: "Código de 8 dígitos que identifica cada mercadoria. Define ICMS, IPI e, na Reforma, a alíquota de IBS/CBS do produto.",
    links: [OFFICIAL_LINKS.nfePortal],
  }),
  term({
    id: "nbs",
    label: "NBS",
    plainExplanation: "Código que identifica o serviço (equivalente ao NCM para serviços). Passa a ser exigido na NFS-e com a Reforma.",
    links: [OFFICIAL_LINKS.nfseNacional],
  }),
  term({
    id: "lc116-item",
    label: "Item da LC 116",
    plainExplanation: "Número do serviço na lista da Lei do ISS (ex.: 1.03 processamento de dados). Define a alíquota de ISS na prefeitura.",
    legalBasis: "LC 116/2003, lista anexa",
    links: [OFFICIAL_LINKS.lc116],
  }),
  term({
    id: "cfop",
    label: "CFOP",
    plainExplanation: "Código que diz a natureza da operação na nota (venda, devolução, remessa...). Ajuda a saber se a entrada dá direito a crédito.",
    links: [OFFICIAL_LINKS.nfePortal],
  }),
  term({
    id: "credito-nao-cumulativo",
    label: "Crédito não cumulativo",
    plainExplanation: "O imposto que veio embutido na sua compra vira crédito para abater do imposto da sua venda. Com a Reforma, quase toda compra com nota gera crédito de IBS/CBS.",
    example: "Comprou R$ 10 mil com R$ 900 de CBS destacada → abate R$ 900 da CBS que você deve nas vendas.",
    legalBasis: "LC 214/2025, art. 47",
    links: [OFFICIAL_LINKS.lc214],
  }),
  term({
    id: "split-payment",
    label: "Split payment",
    plainExplanation: "Na hora do pagamento (PIX, cartão, boleto), o banco separa automaticamente a parte do imposto e manda direto ao governo. Deve ser implantado aos poucos a partir de 2027.",
    legalBasis: "LC 214/2025, arts. 31 a 35",
    links: [OFFICIAL_LINKS.lc214],
  }),
  term({
    id: "simples-por-fora",
    label: "IBS/CBS por fora do Simples",
    plainExplanation: "A partir de 2027 a empresa do Simples pode recolher IBS/CBS fora do DAS, com alíquota cheia. Paga mais, mas o cliente PJ aproveita crédito cheio — pode valer a pena para quem vende para empresas.",
    legalBasis: "LC 214/2025, art. 41",
    links: [OFFICIAL_LINKS.lc214],
  }),
  term({
    id: "competencia",
    label: "Competência x caixa",
    plainExplanation: "Competência é quando a venda/despesa aconteceu; caixa é quando o dinheiro entrou ou saiu. Imposto e contabilidade usam competência; o fluxo de caixa usa caixa.",
    links: [],
  }),
  term({
    id: "partida-dobrada",
    label: "Partida dobrada",
    plainExplanation: "Todo lançamento contábil tem dois lados que se equilibram: um débito e um crédito do mesmo valor. É o que garante que o balancete feche.",
    example: "Pagar a conta de luz: débito em Despesa de energia, crédito em Banco.",
    links: [],
  }),
  term({
    id: "plano-de-contas",
    label: "Plano de contas",
    plainExplanation: "A lista organizada de 'gavetas' contábeis (ativo, passivo, receitas, despesas) onde cada lançamento é guardado.",
    links: [],
  }),
  term({
    id: "balancete",
    label: "Balancete",
    plainExplanation: "Relatório com o saldo de cada conta contábil no período. Se débitos e créditos baterem, a escrituração está íntegra.",
    links: [],
  }),
  term({
    id: "razao",
    label: "Razão",
    plainExplanation: "Todos os lançamentos de uma conta contábil, em ordem, com o saldo acumulado.",
    links: [],
  }),
  term({
    id: "balanco",
    label: "Balanço patrimonial",
    plainExplanation: "Foto da empresa numa data: o que ela tem (ativo), o que deve (passivo) e o que é dos sócios (patrimônio líquido).",
    links: [],
  }),
  term({
    id: "lalur",
    label: "LALUR",
    plainExplanation: "Livro de Apuração do Lucro Real: ajusta o lucro contábil (adições e exclusões) para chegar à base do IRPJ.",
    legalBasis: "Decreto 9.580/2018, art. 277",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "carne-leao",
    label: "Carnê-leão",
    plainExplanation: "Imposto mensal que a pessoa física paga sobre rendimentos recebidos de outras pessoas físicas ou do exterior (aluguel, consultas particulares).",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "pro-labore",
    label: "Pró-labore",
    plainExplanation: "Remuneração do sócio pelo trabalho na empresa. Tem INSS de 11% e IR na tabela progressiva. Diferente da distribuição de lucros.",
    legalBasis: "Lei 8.212/1991, art. 21",
    links: [OFFICIAL_LINKS.esocial],
  }),
  term({
    id: "distribuicao-lucros",
    label: "Distribuição de lucros",
    plainExplanation: "Parte do lucro já tributado na empresa que vai para o sócio. Hoje é isenta de IR para quem recebe.",
    legalBasis: "Lei 9.249/1995, art. 10",
    links: [],
  }),
  term({
    id: "irrf",
    label: "IRRF",
    plainExplanation: "Imposto de renda descontado na fonte: quem paga já retém e recolhe. Vale para salários, pró-labore e alguns serviços.",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "retencao-na-fonte",
    label: "Retenção na fonte",
    plainExplanation: "Quando o cliente PJ desconta impostos (IRRF, PIS/COFINS/CSLL, INSS, ISS) do valor da sua nota e paga direto ao governo. Você recebe menos, mas o imposto já foi pago.",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "multa-mora",
    label: "Multa de mora",
    plainExplanation: "Multa por pagar tributo federal atrasado: 0,33% por dia, até no máximo 20%.",
    legalBasis: "Lei 9.430/1996, art. 61",
    links: [OFFICIAL_LINKS.selicReceita],
  }),
  term({
    id: "selic",
    label: "Juros Selic",
    plainExplanation: "Juros cobrados sobre tributo federal atrasado: a Selic acumulada desde o mês seguinte ao vencimento, mais 1% no mês do pagamento.",
    legalBasis: "Lei 9.430/1996, art. 61 §3º",
    links: [OFFICIAL_LINKS.selicReceita],
  }),
  term({
    id: "markup-divisor",
    label: "Markup divisor",
    plainExplanation: "Jeito certo de formar preço: divide o custo por (100% − impostos − comissão − margem). Somar porcentagens ao custo dá preço errado.",
    example: "Custo R$ 60, impostos 10%, comissão 5%, margem 25% → 60 ÷ 60% = R$ 100.",
    links: [],
  }),
  term({
    id: "margem-liquida",
    label: "Margem líquida",
    plainExplanation: "O que sobra do preço depois de custo, impostos e comissão, em porcentagem do preço.",
    links: [],
  }),
  term({
    id: "depreciacao",
    label: "Depreciação",
    plainExplanation: "A perda de valor de um bem (computador, carro, máquina) espalhada pelos meses de uso. Vira despesa contábil sem sair dinheiro do caixa.",
    legalBasis: "IN RFB 1.700/2017, Anexo III",
    links: [],
  }),
  term({
    id: "provisao-ferias",
    label: "Provisão de férias e 13º",
    plainExplanation: "Guardar todo mês 1/12 das férias (+1/3) e do 13º para não ser pego de surpresa no fim do ano.",
    links: [],
  }),
  term({
    id: "cnd",
    label: "CND (Certidão Negativa de Débitos)",
    plainExplanation: "Documento que prova que a empresa não deve impostos àquele órgão. Exigida em licitações, empréstimos e grandes contratos. Tem validade curta (geralmente 30 a 180 dias).",
    links: [OFFICIAL_LINKS.cndFederal],
  }),
  term({
    id: "crf-fgts",
    label: "CRF do FGTS",
    plainExplanation: "Certificado de Regularidade do FGTS, emitido pela Caixa. Vale 30 dias.",
    links: [OFFICIAL_LINKS.crfFgts],
  }),
  term({
    id: "cndt",
    label: "CNDT",
    plainExplanation: "Certidão Negativa de Débitos Trabalhistas, emitida pelo TST. Prova que a empresa não tem dívidas em processos trabalhistas. Vale 180 dias.",
    links: [OFFICIAL_LINKS.cndt],
  }),
  term({
    id: "certificado-digital",
    label: "Certificado digital (e-CNPJ)",
    plainExplanation: "A 'assinatura eletrônica' da empresa. O A1 é um arquivo (.pfx) que vale 1 ano; o A3 fica num token/cartão. É necessário para emitir nota e acessar o e-CAC.",
    links: [OFFICIAL_LINKS.ecac],
  }),
  term({
    id: "score-regularidade",
    label: "Score de regularidade",
    plainExplanation: "Mede, de 0 a 100%, quanto da papelada obrigatória da empresa está em dia: documentos válidos, guias pagas e notas do mês enviadas. Um mês de guia em aberto já derruba o score.",
    links: [],
  }),
  term({
    id: "obrigacao-acessoria",
    label: "Obrigação acessória",
    plainExplanation: "Declarações e informações que a empresa precisa entregar ao governo, além de pagar o imposto (DEFIS, DCTFWeb, EFD-Reinf, eSocial...). Atrasar gera multa.",
    links: [OFFICIAL_LINKS.ecac],
  }),
];

const TERMS_BY_ID = new Map(GLOSSARY_TERMS.map((glossaryTerm) => [glossaryTerm.id, glossaryTerm]));

export function findGlossaryTerm(termId: string): GlossaryTerm | undefined {
  return TERMS_BY_ID.get(termId);
}

export function searchGlossary(query: string): GlossaryTerm[] {
  const normalized = normalize(query);
  return GLOSSARY_TERMS.filter(
    (glossaryTerm) =>
      normalize(glossaryTerm.label).includes(normalized) ||
      normalize(glossaryTerm.id).includes(normalized) ||
      normalize(glossaryTerm.plainExplanation).includes(normalized),
  );
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
