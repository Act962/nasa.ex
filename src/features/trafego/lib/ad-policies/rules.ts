import type { PolicyRule } from "./types";

/**
 * Regras curadas à mão a partir das fontes em `sources.ts`.
 *
 * Critério de severidade:
 *  - **BLOCKED**: a plataforma recusa E o risco é de restrição da conta. Não
 *    adianta tentar; o cliente perderia verba e a conta junto.
 *  - **WARNING**: costuma passar, mas reprova com frequência ou exige
 *    documentação. O cliente decide seguir depois de ler o aviso.
 *
 * Nada aqui é conselho jurídico — é o que a equipe já viu reprovar.
 */
export const POLICY_RULES: PolicyRule[] = [
  // ── Bloqueios ───────────────────────────────────────────────────────────
  {
    id: "prescription-weight-loss",
    label: "Medicamento sob prescrição",
    reason:
      "Meta proíbe anúncio de medicamentos sob prescrição, e o Google exige certificação de farmácia — que nenhum anunciante comum tem.",
    fix: "Anuncie a consulta, o acompanhamento ou a clínica, sem citar o medicamento nem prometer perda de peso.",
    level: "BLOCKED",
    sourceId: "meta-ad-standards",
    terms: [
      "mounjaro", "ozempic", "wegovy", "saxenda", "victoza", "trulicity",
      "semaglutida", "tirzepatida", "liraglutida", "sibutramina", "anfepramona",
      "caneta emagrecedora", "canetas emagrecedoras", "rivotril", "clonazepam",
      "tramadol", "anabolizante", "anabolizantes", "oxandrolona", "stanozolol",
    ],
  },
  {
    id: "tobacco-vape",
    label: "Tabaco e vape",
    reason: "Produtos de tabaco e dispositivos de vaporização são proibidos nas duas plataformas.",
    fix: "Este produto não pode ser anunciado por tráfego pago.",
    level: "BLOCKED",
    sourceId: "meta-ad-standards",
    terms: ["vape", "vapes", "pod descartavel", "cigarro eletronico", "narguile", "essencia para narguile", "tabaco"],
  },
  {
    id: "weapons",
    label: "Armas e munições",
    reason: "Armas, munições, acessórios e explosivos são proibidos em anúncios.",
    fix: "Este produto não pode ser anunciado por tráfego pago.",
    level: "BLOCKED",
    sourceId: "meta-ad-standards",
    terms: ["arma de fogo", "armas de fogo", "municao", "municoes", "silenciador", "pistola", "revolver", "fuzil"],
  },
  {
    id: "gambling",
    label: "Apostas e jogos de azar",
    reason:
      "Apostas exigem autorização prévia da plataforma e licença. Sem isso o anúncio é recusado e a conta pode ser restrita.",
    fix: "Se você tem licença e autorização da Meta/Google, fale com um gestor — esse caso não passa pelo checkout automático.",
    level: "BLOCKED",
    sourceId: "google-ads-policies",
    terms: [
      "aposta", "apostas", "cassino", "casino", "jogo do bicho", "tigrinho",
      "fortune tiger", "bet365", "blaze", "raspadinha online", "bingo online",
    ],
  },
  {
    id: "adult",
    label: "Conteúdo adulto",
    reason: "Conteúdo adulto e serviços sexuais são proibidos.",
    fix: "Este produto não pode ser anunciado por tráfego pago.",
    level: "BLOCKED",
    sourceId: "meta-ad-standards",
    terms: ["conteudo adulto", "sex shop", "acompanhante", "onlyfans", "privacy", "camgirl", "pornografia"],
  },
  {
    id: "counterfeit",
    label: "Réplicas e falsificados",
    reason: "Produtos falsificados violam as políticas de propriedade intelectual das duas plataformas.",
    fix: "Anuncie apenas produtos originais ou de marca própria.",
    level: "BLOCKED",
    sourceId: "google-ads-policies",
    terms: ["replica", "replicas", "primeira linha", "falsificado", "falsificados", "tipo original", "aaa importado"],
  },
  {
    id: "illicit-services",
    label: "Serviço ilícito",
    reason: "Facilitar fraude, invasão de contas ou documentos falsos é proibido e é crime.",
    fix: "Este serviço não pode ser anunciado.",
    level: "BLOCKED",
    sourceId: "google-ads-policies",
    terms: [
      "hackear", "invadir whatsapp", "espionar whatsapp", "clonar whatsapp",
      "cnh sem prova", "diploma sem curso", "limpar nome sujo na hora", "hackeamento",
    ],
  },
  {
    id: "weight-loss-promise",
    label: "Promessa de emagrecimento com prazo",
    reason:
      "A Meta proíbe prometer resultado específico de perda de peso e conteúdo que gere percepção negativa do corpo. É a alegação que mais restringe conta.",
    fix: "Troque por benefício sem número e sem prazo: “acompanhamento nutricional individual”, por exemplo.",
    level: "BLOCKED",
    sourceId: "meta-ad-standards",
    terms: [],
    patterns: [
      /\b(emagre[çc]a|perca|elimine|seque)\b[^.!?]{0,40}\b\d+\s*(kg|quilos?|cm|medidas?)\b/i,
      /\b\d+\s*(kg|quilos?)\b[^.!?]{0,30}\b(em|ate)\b\s*\d+\s*(dias?|semanas?|meses?)\b/i,
      /\b(emagre[çc]a|perca peso|seque a barriga)\b[^.!?]{0,30}\b(em|ate)\b\s*\d+\s*(dias?|semanas?|meses?)\b/i,
    ],
  },

  // ── Avisos ──────────────────────────────────────────────────────────────
  {
    id: "guaranteed-result",
    label: "Promessa de resultado garantido",
    reason:
      "Garantia de resultado é alegação enganosa para as plataformas — e, no Brasil, publicidade enganosa pelo CDC.",
    fix: "Fale do que você entrega (método, atendimento, prazo), não do resultado que o cliente vai ter.",
    level: "WARNING",
    sourceId: "meta-ad-standards",
    terms: [
      "resultado garantido", "resultados garantidos", "garantia de resultado",
      "100% garantido", "sucesso garantido", "aprovacao garantida", "lucro garantido",
      "retorno garantido", "ganho garantido",
    ],
  },
  {
    id: "cure-claim",
    label: "Promessa de cura",
    reason: "Alegar cura ou tratamento de doença é proibido sem registro sanitário, e a Anvisa também veda.",
    fix: "Descreva o serviço sem afirmar que cura, trata ou elimina doença.",
    level: "WARNING",
    sourceId: "meta-ad-standards",
    terms: ["cura definitiva", "cura garantida", "elimina de vez", "acaba com a doenca", "milagroso", "milagrosa", "milagre", "remedio caseiro que cura"],
  },
  {
    id: "effortless-claim",
    label: "Promessa de resultado sem esforço",
    reason: "“Sem dieta”, “sem exercício”, “sem sair de casa e ganhando” são alegações irreais para as plataformas.",
    fix: "Prefira descrever o que o cliente recebe, não o que ele deixa de fazer.",
    level: "WARNING",
    sourceId: "meta-ad-standards",
    terms: ["sem dieta", "sem exercicio", "sem esforco", "sem fazer nada", "sem sair do sofa", "dinheiro facil", "ganhe dinheiro dormindo"],
  },
  {
    id: "before-after",
    label: "Antes e depois",
    reason: "Imagem ou promessa de “antes e depois” é proibida pela Meta em saúde, estética e emagrecimento.",
    fix: "Use depoimento em texto ou o resultado do serviço, sem comparar corpos.",
    level: "WARNING",
    sourceId: "meta-ad-standards",
    terms: ["antes e depois", "antes x depois", "antes/depois"],
  },
  {
    id: "income-claim",
    label: "Promessa de renda",
    reason: "Valores específicos de ganho exigem comprovação e costumam ser recusados como oportunidade enganosa.",
    fix: "Fale do conteúdo ou do serviço, sem prometer quanto a pessoa vai ganhar.",
    level: "WARNING",
    sourceId: "google-ads-policies",
    terms: ["fique rico", "renda extra garantida", "primeiro milhao", "liberdade financeira garantida"],
    patterns: [
      /\b(ganhe|fature|lucre|renda de)\b[^.!?]{0,25}\br?\$\s?[\d.]+/i,
      /\br?\$\s?[\d.]+[^.!?]{0,20}\b(por dia|por semana|em \d+ dias)\b/i,
    ],
  },
  {
    id: "restricted-alcohol",
    label: "Bebida alcoólica",
    reason: "Álcool é categoria restrita: exige segmentação por idade e é proibido em algumas regiões.",
    fix: "Pode anunciar. A equipe ajusta a segmentação de idade na configuração.",
    level: "WARNING",
    sourceId: "google-ads-policies",
    terms: ["cerveja", "cervejaria", "vinho", "vinhos", "destilado", "destilados", "cachaca", "whisky", "gin", "adega", "distribuidora de bebidas"],
  },
  {
    id: "restricted-supplements",
    label: "Suplemento alimentar",
    reason: "Suplementos são restritos: não podem alegar efeito terapêutico nem resultado de emagrecimento.",
    fix: "Evite alegação de saúde na copy. A equipe revisa o texto antes de publicar.",
    level: "WARNING",
    sourceId: "meta-ad-standards",
    terms: ["suplemento", "suplementos", "whey", "creatina", "termogenico", "emagrecedor", "queimador de gordura"],
  },
  {
    id: "restricted-health",
    label: "Saúde e estética",
    reason: "Procedimentos de saúde e estética são restritos: sem antes/depois, sem promessa de resultado e com registro profissional visível.",
    fix: "Pode anunciar. Mantenha o registro profissional no material e evite promessa de resultado.",
    level: "WARNING",
    sourceId: "meta-ad-standards",
    terms: ["harmonizacao facial", "botox", "preenchimento labial", "lipoaspiracao", "implante capilar", "clinica estetica", "cirurgia plastica", "bariatrica"],
  },
  {
    id: "restricted-financial",
    label: "Crédito e serviço financeiro",
    reason: "Crédito e empréstimo são categoria especial: exigem transparência de taxas e não permitem segmentar por idade e gênero.",
    fix: "Pode anunciar. A equipe ajusta a segmentação conforme a regra de categoria especial.",
    level: "WARNING",
    sourceId: "google-ads-policies",
    terms: ["emprestimo", "emprestimos", "credito consignado", "antecipacao do fgts", "financiamento", "limpa nome", "consorcio"],
  },
];
