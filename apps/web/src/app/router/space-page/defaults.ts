// Defaults para Spacehome — seeds idempotentes (upsert por slug).
// Cada entrada é uma "linha" a inserir via `prisma.<model>.upsert`.

// ─── Job Title Catalog ────────────────────────────────────────────────────
// level: 0=C-level, 1=diretor, 2=gerente/head, 3=sênior, 4=pleno, 5=jr

export type JobTitleSeed = {
  title: string;
  slug: string;
  category:
    | "EXECUTIVE"
    | "TECH"
    | "DESIGN"
    | "PRODUCT"
    | "MARKETING"
    | "SALES"
    | "OPERATIONS"
    | "FINANCE"
    | "HR"
    | "LEGAL"
    | "OTHER";
  level: number;
};

export const DEFAULT_JOB_TITLES: JobTitleSeed[] = [
  // Executive / C-level
  { title: "Presidente", slug: "presidente", category: "EXECUTIVE", level: 0 },
  { title: "CEO", slug: "ceo", category: "EXECUTIVE", level: 0 },
  { title: "COO", slug: "coo", category: "EXECUTIVE", level: 0 },
  { title: "CTO", slug: "cto", category: "EXECUTIVE", level: 0 },
  { title: "CFO", slug: "cfo", category: "EXECUTIVE", level: 0 },
  { title: "CMO", slug: "cmo", category: "EXECUTIVE", level: 0 },
  { title: "CPO", slug: "cpo", category: "EXECUTIVE", level: 0 },
  { title: "CHRO", slug: "chro", category: "EXECUTIVE", level: 0 },
  { title: "Fundador", slug: "fundador", category: "EXECUTIVE", level: 0 },
  { title: "Cofundador", slug: "cofundador", category: "EXECUTIVE", level: 0 },

  // Diretorias
  { title: "Diretor de Engenharia", slug: "diretor-engenharia", category: "TECH", level: 1 },
  { title: "Diretor de Produto", slug: "diretor-produto", category: "PRODUCT", level: 1 },
  { title: "Diretor de Design", slug: "diretor-design", category: "DESIGN", level: 1 },
  { title: "Diretor de Marketing", slug: "diretor-marketing", category: "MARKETING", level: 1 },
  { title: "Diretor de Vendas", slug: "diretor-vendas", category: "SALES", level: 1 },
  { title: "Diretor de Operações", slug: "diretor-operacoes", category: "OPERATIONS", level: 1 },
  { title: "Diretor Financeiro", slug: "diretor-financeiro", category: "FINANCE", level: 1 },
  { title: "Diretor de RH", slug: "diretor-rh", category: "HR", level: 1 },
  { title: "VP de Engenharia", slug: "vp-engenharia", category: "TECH", level: 1 },
  { title: "VP de Vendas", slug: "vp-vendas", category: "SALES", level: 1 },
  { title: "VP de Produto", slug: "vp-produto", category: "PRODUCT", level: 1 },

  // Heads / Gerentes
  { title: "Head of Product", slug: "head-of-product", category: "PRODUCT", level: 2 },
  { title: "Head of Engineering", slug: "head-of-engineering", category: "TECH", level: 2 },
  { title: "Head of Design", slug: "head-of-design", category: "DESIGN", level: 2 },
  { title: "Head of Growth", slug: "head-of-growth", category: "MARKETING", level: 2 },
  { title: "Head of Sales", slug: "head-of-sales", category: "SALES", level: 2 },
  { title: "Head of People", slug: "head-of-people", category: "HR", level: 2 },
  { title: "Product Manager", slug: "product-manager", category: "PRODUCT", level: 2 },
  { title: "Project Manager", slug: "project-manager", category: "OPERATIONS", level: 2 },
  { title: "Engineering Manager", slug: "engineering-manager", category: "TECH", level: 2 },
  { title: "Tech Lead", slug: "tech-lead", category: "TECH", level: 2 },
  { title: "Marketing Manager", slug: "marketing-manager", category: "MARKETING", level: 2 },

  // Tech
  { title: "Desenvolvedor Frontend", slug: "dev-frontend", category: "TECH", level: 3 },
  { title: "Desenvolvedor Backend", slug: "dev-backend", category: "TECH", level: 3 },
  { title: "Desenvolvedor Full-stack", slug: "dev-fullstack", category: "TECH", level: 3 },
  { title: "Desenvolvedor Mobile", slug: "dev-mobile", category: "TECH", level: 3 },
  { title: "DevOps Engineer", slug: "devops-engineer", category: "TECH", level: 3 },
  { title: "Site Reliability Engineer", slug: "sre", category: "TECH", level: 3 },
  { title: "Data Engineer", slug: "data-engineer", category: "TECH", level: 3 },
  { title: "Data Scientist", slug: "data-scientist", category: "TECH", level: 3 },
  { title: "Machine Learning Engineer", slug: "ml-engineer", category: "TECH", level: 3 },
  { title: "QA Engineer", slug: "qa-engineer", category: "TECH", level: 3 },

  // Design
  { title: "UX Designer", slug: "ux-designer", category: "DESIGN", level: 3 },
  { title: "UI Designer", slug: "ui-designer", category: "DESIGN", level: 3 },
  { title: "Product Designer", slug: "product-designer", category: "DESIGN", level: 3 },
  { title: "Motion Designer", slug: "motion-designer", category: "DESIGN", level: 3 },
  { title: "Designer Gráfico", slug: "designer-grafico", category: "DESIGN", level: 3 },

  // Produto
  { title: "Product Owner", slug: "product-owner", category: "PRODUCT", level: 3 },
  { title: "Product Analyst", slug: "product-analyst", category: "PRODUCT", level: 3 },

  // Marketing
  { title: "Analista de Marketing", slug: "analista-marketing", category: "MARKETING", level: 3 },
  { title: "Performance Marketing", slug: "performance-marketing", category: "MARKETING", level: 3 },
  { title: "SEO Specialist", slug: "seo-specialist", category: "MARKETING", level: 3 },
  { title: "Social Media", slug: "social-media", category: "MARKETING", level: 3 },
  { title: "Redator / Copywriter", slug: "copywriter", category: "MARKETING", level: 3 },
  { title: "Growth Analyst", slug: "growth-analyst", category: "MARKETING", level: 3 },

  // Vendas
  { title: "SDR", slug: "sdr", category: "SALES", level: 4 },
  { title: "BDR", slug: "bdr", category: "SALES", level: 4 },
  { title: "Account Executive", slug: "account-executive", category: "SALES", level: 3 },
  { title: "Closer", slug: "closer", category: "SALES", level: 3 },
  { title: "Customer Success Manager", slug: "csm", category: "SALES", level: 3 },
  { title: "Customer Support", slug: "customer-support", category: "SALES", level: 4 },

  // Operações / Finance / Legal / HR
  { title: "Analista Financeiro", slug: "analista-financeiro", category: "FINANCE", level: 3 },
  { title: "Controller", slug: "controller", category: "FINANCE", level: 2 },
  { title: "Contador", slug: "contador", category: "FINANCE", level: 3 },
  { title: "RH Business Partner", slug: "hrbp", category: "HR", level: 3 },
  { title: "Recrutador(a)", slug: "recrutador", category: "HR", level: 3 },
  { title: "Advogado(a)", slug: "advogado", category: "LEGAL", level: 3 },
  { title: "Analista de Operações", slug: "analista-operacoes", category: "OPERATIONS", level: 3 },

  // Outros
  { title: "Estagiário(a)", slug: "estagiario", category: "OTHER", level: 5 },
  { title: "Assistente", slug: "assistente", category: "OTHER", level: 5 },
];

// ─── Skills ──────────────────────────────────────────────────────────────

export type SkillSeed = { name: string; slug: string };

export const DEFAULT_SKILLS: SkillSeed[] = [
  { name: "React", slug: "react" },
  { name: "Next.js", slug: "nextjs" },
  { name: "TypeScript", slug: "typescript" },
  { name: "JavaScript", slug: "javascript" },
  { name: "Node.js", slug: "nodejs" },
  { name: "Python", slug: "python" },
  { name: "Go", slug: "go" },
  { name: "Rust", slug: "rust" },
  { name: "Java", slug: "java" },
  { name: "SQL", slug: "sql" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "MongoDB", slug: "mongodb" },
  { name: "Redis", slug: "redis" },
  { name: "GraphQL", slug: "graphql" },
  { name: "REST APIs", slug: "rest-apis" },
  { name: "Docker", slug: "docker" },
  { name: "Kubernetes", slug: "kubernetes" },
  { name: "AWS", slug: "aws" },
  { name: "GCP", slug: "gcp" },
  { name: "CI/CD", slug: "cicd" },
  { name: "Tailwind CSS", slug: "tailwind-css" },
  { name: "CSS", slug: "css" },
  { name: "HTML", slug: "html" },
  { name: "Design System", slug: "design-system" },
  { name: "UX Research", slug: "ux-research" },
  { name: "UI Design", slug: "ui-design" },
  { name: "Product Discovery", slug: "product-discovery" },
  { name: "Product Management", slug: "product-management" },
  { name: "Agile / Scrum", slug: "agile-scrum" },
  { name: "Data Analysis", slug: "data-analysis" },
  { name: "Machine Learning", slug: "machine-learning" },
  { name: "SEO", slug: "seo" },
  { name: "Performance Marketing", slug: "performance-marketing" },
  { name: "Copywriting", slug: "copywriting" },
  { name: "Vendas B2B", slug: "vendas-b2b" },
  { name: "Customer Success", slug: "customer-success" },
];

// ─── Tool Catalog ────────────────────────────────────────────────────────

export type ToolSeed = {
  name: string;
  slug: string;
  category: string | null;
  iconUrl: string | null;
};

export const DEFAULT_TOOLS: ToolSeed[] = [
  { name: "Figma", slug: "figma", category: "design", iconUrl: null },
  { name: "Sketch", slug: "sketch", category: "design", iconUrl: null },
  { name: "Adobe XD", slug: "adobe-xd", category: "design", iconUrl: null },
  { name: "Photoshop", slug: "photoshop", category: "design", iconUrl: null },
  { name: "Illustrator", slug: "illustrator", category: "design", iconUrl: null },
  { name: "Canva", slug: "canva", category: "design", iconUrl: null },

  { name: "VS Code", slug: "vscode", category: "dev", iconUrl: null },
  { name: "Cursor", slug: "cursor", category: "dev", iconUrl: null },
  { name: "GitHub", slug: "github", category: "dev", iconUrl: null },
  { name: "GitLab", slug: "gitlab", category: "dev", iconUrl: null },
  { name: "Vercel", slug: "vercel", category: "dev", iconUrl: null },

  { name: "Notion", slug: "notion", category: "pm", iconUrl: null },
  { name: "Linear", slug: "linear", category: "pm", iconUrl: null },
  { name: "Jira", slug: "jira", category: "pm", iconUrl: null },
  { name: "Trello", slug: "trello", category: "pm", iconUrl: null },
  { name: "Asana", slug: "asana", category: "pm", iconUrl: null },

  { name: "Slack", slug: "slack", category: "comm", iconUrl: null },
  { name: "Discord", slug: "discord", category: "comm", iconUrl: null },
  { name: "Zoom", slug: "zoom", category: "comm", iconUrl: null },
  { name: "Google Meet", slug: "google-meet", category: "comm", iconUrl: null },

  { name: "ChatGPT", slug: "chatgpt", category: "ai", iconUrl: null },
  { name: "Claude", slug: "claude", category: "ai", iconUrl: null },
  { name: "Midjourney", slug: "midjourney", category: "ai", iconUrl: null },
  { name: "Runway", slug: "runway", category: "ai", iconUrl: null },

  { name: "Google Workspace", slug: "google-workspace", category: "productivity", iconUrl: null },
  { name: "Microsoft 365", slug: "microsoft-365", category: "productivity", iconUrl: null },
];
