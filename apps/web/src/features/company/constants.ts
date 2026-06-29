// Constantes de domínio: tipo de empresa + cargos hierárquicos
// Usadas em signup, settings/company, members-tab e validação server-side.

export interface CompanyTypeOption {
  slug: string;
  label: string;
  description?: string;
}

export const COMPANY_TYPES: CompanyTypeOption[] = [
  { slug: "agencia-publicidade", label: "Agência de Publicidade", description: "Criação, branding e campanhas" },
  { slug: "agencia-trafego", label: "Agência de Tráfego/Marketing", description: "Performance, mídia paga, lançamentos" },
  { slug: "agencia-seo", label: "Agência de SEO/Conteúdo", description: "SEO, blog, growth orgânico" },
  { slug: "ecommerce", label: "E-commerce", description: "Loja online própria ou marketplaces" },
  { slug: "consultoria", label: "Consultoria", description: "Consultoria empresarial, estratégica ou técnica" },
  { slug: "oficina-automotiva", label: "Oficina Automotiva", description: "Mecânica, funilaria, estética automotiva" },
  { slug: "estudio-design", label: "Estúdio de Design", description: "Design gráfico, UI/UX, ilustração" },
  { slug: "imobiliaria", label: "Imobiliária", description: "Vendas, locação, incorporação" },
  { slug: "clinica", label: "Clínica / Saúde", description: "Clínicas, consultórios, estética" },
  { slug: "educacao", label: "Educação / Cursos", description: "Cursos, escolas, edtech" },
  { slug: "software-house", label: "Software House / Tech", description: "Desenvolvimento, SaaS, tech" },
  { slug: "industria", label: "Indústria / Manufatura", description: "Produção industrial e fabril" },
  { slug: "alimentacao", label: "Restaurante / Alimentação", description: "Restaurantes, delivery, food service" },
  { slug: "construcao", label: "Construção / Engenharia", description: "Construtoras, reformas, engenharia" },
  { slug: "advocacia", label: "Advocacia / Jurídico", description: "Escritórios de advocacia e consultoria jurídica" },
  { slug: "contabilidade", label: "Contabilidade / Finanças", description: "Escritórios contábeis e financeiros" },
  { slug: "varejo", label: "Varejo / Comércio", description: "Loja física, distribuidora" },
  { slug: "servicos", label: "Serviços (geral)", description: "Prestação de serviços B2B/B2C" },
  { slug: "infoprodutor", label: "Infoprodutor / Creator", description: "Cursos, mentorias, conteúdo digital" },
  { slug: "outro", label: "Outro", description: "Outro segmento" },
];

export const COMPANY_TYPE_SLUGS = COMPANY_TYPES.map((t) => t.slug);

export function getCompanyTypeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return COMPANY_TYPES.find((t) => t.slug === slug)?.label ?? slug;
}

// ─── Cargos hierárquicos ───────────────────────────────────────────────
// 6 tiers: N1 (fundadores) / N2 (C-level) / N3 (gerência sênior) /
// Gestão / Operacional / Entrada-Suporte.
// `lideranca` é mantido como alias legado pra não quebrar callers — code
// novo deve usar n1/n2/n3.

export type PositionGroup =
  | "n1"
  | "n2"
  | "n3"
  | "gestao"
  | "operacional"
  | "entrada"
  | "lideranca"; // legacy

export interface PositionOption {
  slug: string;
  label: string;
  level: number;
  group: PositionGroup;
}

export const POSITIONS: PositionOption[] = [
  // ─── N1: Fundadores / Presidência ──────────────────────────
  { slug: "ceo",         label: "CEO",                     level: 1, group: "n1" },
  { slug: "presidente",  label: "Presidente",              level: 1, group: "n1" },
  { slug: "socio",       label: "Sócio-Fundador",          level: 1, group: "n1" },
  { slug: "co-founder",  label: "Co-Founder",              level: 1, group: "n1" },

  // ─── N2: C-Level / Diretoria estratégica ────────────────────
  { slug: "cto",         label: "CTO",                     level: 2, group: "n2" },
  { slug: "cmo",         label: "CMO",                     level: 2, group: "n2" },
  { slug: "coo",         label: "COO",                     level: 2, group: "n2" },
  { slug: "cfo",         label: "CFO",                     level: 2, group: "n2" },
  { slug: "cpo",         label: "CPO",                     level: 2, group: "n2" },
  { slug: "cro",         label: "CRO",                     level: 2, group: "n2" },
  { slug: "chro",        label: "CHRO",                    level: 2, group: "n2" },
  { slug: "diretor",     label: "Diretor(a)",              level: 2, group: "n2" },
  { slug: "vp",          label: "VP",                      level: 2, group: "n2" },

  // ─── N3: Heads / Gerentes Sênior ────────────────────────────
  { slug: "head",                  label: "Head",                       level: 3, group: "n3" },
  { slug: "gerente-geral",         label: "Gerente Geral",              level: 3, group: "n3" },
  { slug: "gerente-comercial",     label: "Gerente Comercial",          level: 3, group: "n3" },
  { slug: "gerente-marketing",     label: "Gerente de Marketing",       level: 3, group: "n3" },
  { slug: "gerente-tecnologia",    label: "Gerente de Tecnologia",      level: 3, group: "n3" },
  { slug: "gerente-operacoes",     label: "Gerente de Operações",       level: 3, group: "n3" },
  { slug: "gerente-rh",            label: "Gerente de RH",              level: 3, group: "n3" },
  { slug: "gerente-financeiro",    label: "Gerente Financeiro",         level: 3, group: "n3" },
  { slug: "gerente-projetos",      label: "Gerente de Projetos",        level: 3, group: "n3" },

  // ─── Gestão: Coordenação / Liderança tática ─────────────────
  { slug: "gerente",                label: "Gerente",            level: 4, group: "gestao" },
  { slug: "coordenador",            label: "Coordenador(a)",     level: 4, group: "gestao" },
  { slug: "supervisor",             label: "Supervisor(a)",      level: 4, group: "gestao" },
  { slug: "lider",                  label: "Líder de Equipe",    level: 4, group: "gestao" },
  { slug: "tech-lead",              label: "Tech Lead",          level: 4, group: "gestao" },
  { slug: "product-manager",        label: "Product Manager",    level: 4, group: "gestao" },
  { slug: "scrum-master",           label: "Scrum Master",       level: 4, group: "gestao" },
  { slug: "coordenador-pedagogico", label: "Coordenador Pedagógico", level: 4, group: "gestao" },
  { slug: "mestre-obras",           label: "Mestre de Obras",    level: 4, group: "gestao" },

  // ─── Operacional: especialistas, analistas, técnicos ────────
  // Comercial / Vendas
  { slug: "consultor-vendas",  label: "Consultor de Vendas",    level: 5, group: "operacional" },
  { slug: "vendedor",          label: "Vendedor",                level: 5, group: "operacional" },
  { slug: "sdr",               label: "SDR / Pré-Vendas",        level: 5, group: "operacional" },
  { slug: "bdr",               label: "BDR",                     level: 5, group: "operacional" },
  { slug: "kam",               label: "Key Account Manager",     level: 5, group: "operacional" },
  { slug: "customer-success",  label: "Customer Success",        level: 5, group: "operacional" },
  // Marketing
  { slug: "marketing-analyst", label: "Analista de Marketing",   level: 5, group: "operacional" },
  { slug: "social-media",      label: "Social Media",            level: 5, group: "operacional" },
  { slug: "trafego-pago",      label: "Gestor de Tráfego Pago",  level: 5, group: "operacional" },
  { slug: "copywriter",        label: "Copywriter",              level: 5, group: "operacional" },
  { slug: "seo-specialist",    label: "Especialista em SEO",     level: 5, group: "operacional" },
  // Tech
  { slug: "dev-backend",       label: "Dev Backend",             level: 5, group: "operacional" },
  { slug: "dev-frontend",      label: "Dev Frontend",            level: 5, group: "operacional" },
  { slug: "dev-fullstack",     label: "Dev Fullstack",           level: 5, group: "operacional" },
  { slug: "dev-mobile",        label: "Dev Mobile",              level: 5, group: "operacional" },
  { slug: "qa",                label: "QA / Testes",             level: 5, group: "operacional" },
  { slug: "devops",            label: "DevOps / SRE",            level: 5, group: "operacional" },
  { slug: "data-analyst",      label: "Analista de Dados",       level: 5, group: "operacional" },
  { slug: "data-scientist",    label: "Cientista de Dados",      level: 5, group: "operacional" },
  // Design
  { slug: "designer-ui",       label: "UI Designer",             level: 5, group: "operacional" },
  { slug: "designer-ux",       label: "UX Designer",             level: 5, group: "operacional" },
  { slug: "designer-grafico",  label: "Designer Gráfico",        level: 5, group: "operacional" },
  { slug: "ilustrador",        label: "Ilustrador",              level: 5, group: "operacional" },
  // Jurídico / Contábil
  { slug: "advogado",          label: "Advogado(a)",             level: 5, group: "operacional" },
  { slug: "paralegal",         label: "Paralegal",               level: 5, group: "operacional" },
  { slug: "contador",          label: "Contador(a)",             level: 5, group: "operacional" },
  // Saúde
  { slug: "medico",            label: "Médico(a)",               level: 5, group: "operacional" },
  { slug: "enfermeiro",        label: "Enfermeiro(a)",           level: 5, group: "operacional" },
  { slug: "psicologo",         label: "Psicólogo(a)",            level: 5, group: "operacional" },
  { slug: "fisioterapeuta",    label: "Fisioterapeuta",          level: 5, group: "operacional" },
  // Engenharia / Construção
  { slug: "engenheiro-civil",  label: "Engenheiro Civil",        level: 5, group: "operacional" },
  { slug: "arquiteto",         label: "Arquiteto(a)",            level: 5, group: "operacional" },
  // Indústria / Operação
  { slug: "operador-producao", label: "Operador de Produção",    level: 5, group: "operacional" },
  { slug: "tecnico",           label: "Técnico(a)",              level: 5, group: "operacional" },
  { slug: "almoxarife",        label: "Almoxarife / Estoque",    level: 5, group: "operacional" },
  // Educação
  { slug: "professor",         label: "Professor(a)",            level: 5, group: "operacional" },
  // RH
  { slug: "rh-analyst",        label: "Analista de RH",          level: 5, group: "operacional" },
  { slug: "recrutador",        label: "Recrutador(a) / Tech Recruiter", level: 5, group: "operacional" },
  // Genéricos
  { slug: "especialista",      label: "Especialista",            level: 5, group: "operacional" },
  { slug: "senior",            label: "Analista Sênior",         level: 5, group: "operacional" },
  { slug: "pleno",             label: "Analista Pleno",          level: 6, group: "operacional" },

  // ─── Entrada / Suporte ──────────────────────────────────────
  { slug: "junior",          label: "Júnior",                 level: 7, group: "entrada" },
  { slug: "assistente",      label: "Assistente / Auxiliar",  level: 7, group: "entrada" },
  { slug: "trainee",         label: "Trainee",                level: 8, group: "entrada" },
  { slug: "estagiario",      label: "Estagiário(a)",          level: 8, group: "entrada" },
  { slug: "suporte",         label: "Suporte / Help Desk",    level: 7, group: "entrada" },
  { slug: "atendente",       label: "Atendente",              level: 7, group: "entrada" },
  { slug: "recepcionista",   label: "Recepcionista",          level: 7, group: "entrada" },
  { slug: "auxiliar-adm",    label: "Auxiliar Administrativo",level: 7, group: "entrada" },
  { slug: "auxiliar-limpeza",label: "Auxiliar de Limpeza",    level: 7, group: "entrada" },
  { slug: "auxiliar-cozinha",label: "Auxiliar de Cozinha",    level: 7, group: "entrada" },
  { slug: "garcom",          label: "Garçom / Garçonete",     level: 7, group: "entrada" },
  { slug: "motorista",       label: "Motorista",              level: 7, group: "entrada" },
  { slug: "entregador",      label: "Entregador",             level: 7, group: "entrada" },
  { slug: "porteiro",        label: "Porteiro / Segurança",   level: 7, group: "entrada" },
  { slug: "freelancer",      label: "Freelancer / PJ",        level: 7, group: "entrada" },
];

export const POSITION_SLUGS = POSITIONS.map((p) => p.slug);

export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  n1:           "N1 — Fundadores",
  n2:           "N2 — Diretoria",
  n3:           "N3 — Gerência Sênior",
  gestao:       "Gestão",
  operacional:  "Operacional",
  entrada:      "Entrada / Suporte",
  lideranca:    "Liderança",
};

export function getPosition(slug: string | null | undefined): PositionOption | null {
  if (!slug) return null;
  return POSITIONS.find((p) => p.slug === slug) ?? null;
}

export function getPositionLabel(slug: string | null | undefined): string | null {
  return getPosition(slug)?.label ?? slug ?? null;
}
