/**
 * Auto-título para sessões do Astro (mostrado no painel "Históricos
 * Astro Explorer"). Heurística simples, sem LLM, sem rede.
 *
 * Padrão: `<App>-<Data?>-<Entidade?>` (3 tokens, separados por hífen).
 *
 * Exemplos:
 *   "Cria um agendamento pra dia 13/03 com o lead João" → "Agenda-13/03-João"
 *   "Quantos leads ativos eu tenho?"                    → "Tracking"
 *   "Lista as ações atrasadas do workspace Marketing"   → "Workspace-Marketing"
 *   "Como faço pra criar uma proposta no Forge?"        → "Forge"
 *   "Receita do mês passado"                            → "Financeiro"
 *
 * Quando nada é detectado, cai pra "Conversa com ASTRO".
 */

const APP_PATTERNS: { app: string; tokens: RegExp[] }[] = [
  {
    app: "Agenda",
    tokens: [
      /\bagend(a|amento|ar)\b/i,
      /\breuni[ãa]o\b/i,
      /\bcompromisso\b/i,
      /\bspacetime\b/i,
      /\bappointment\b/i,
    ],
  },
  {
    app: "Tracking",
    tokens: [
      /\bleads?\b/i,
      /\btracking\b/i,
      /\bpipeline\b/i,
      /\bfunil\b/i,
      /\bconvers[ãa]o\b/i,
      /\bcrm\b/i,
    ],
  },
  {
    app: "Forge",
    tokens: [/\bforge\b/i, /\bproposta\b/i, /\bcontrato\b/i, /\borcamento|orçamento\b/i],
  },
  {
    app: "Workspace",
    tokens: [
      /\bworkspace\b/i,
      /\ba[çc][ãa]o\b/i,
      /\ba[çc][õo]es\b/i,
      /\btarefa\b/i,
      /\btarefas\b/i,
      /\bafazer\b/i,
    ],
  },
  {
    app: "Chat",
    tokens: [
      /\bchat\b/i,
      /\bconversa(s)?\b/i,
      /\bmensage(m|ns)\b/i,
      /\bwhatsapp\b/i,
    ],
  },
  {
    app: "Forms",
    tokens: [/\bformul[áa]rios?\b/i, /\bsubmiss(õ|o)es\b/i],
  },
  {
    app: "Financeiro",
    tokens: [
      /\bfinanceiro\b/i,
      /\breceita\b/i,
      /\bdespesa\b/i,
      /\bsaldo\b/i,
      /\bcaixa\b/i,
      /\binadimpl[êe]ncia\b/i,
      /\bcontas?\s+(a\s+)?(pagar|receber)\b/i,
    ],
  },
  {
    app: "NASA Route",
    tokens: [/\bcursos?\b/i, /\bnasa\s+route\b/i, /\baulas?\b/i, /\btrilhas?\b/i, /\bmatr[íi]cula\b/i],
  },
  {
    app: "Linnker",
    tokens: [/\blinnker\b/i, /\bbio\s*link\b/i],
  },
  {
    app: "NBox",
    tokens: [/\bnbox\b/i, /\bstorage\b/i, /\barquivos?\b/i, /\bpasta(s)?\b/i],
  },
  {
    app: "Insights",
    tokens: [/\binsights?\b/i, /\brelatórios?|relatorios?\b/i, /\bdashboard\b/i],
  },
  {
    app: "Integrações",
    tokens: [/\bintegra[çc][õo]es\b/i, /\bintegrar\b/i, /\bconectar?\b/i, /\bmeta\s+ads\b/i],
  },
  {
    app: "Space Help",
    tokens: [
      /\bspace\s*help\b/i,
      /\btutorial\b/i,
      /\b(como\s+(crio|criar|fa[çc]o|uso)|me\s+ensina)\b/i,
      /\b(vídeo|video)\b/i,
    ],
  },
  {
    app: "Automação",
    tokens: [
      /\bautoma[çc][ãa]o\b/i,
      /\balerta\b/i,
      /\bnotificar?\b/i,
      /\bme\s+avise\b/i,
    ],
  },
];

/**
 * Tenta extrair uma data brasileira (DD/MM, DD/MM/AAAA, "amanhã", "hoje",
 * "sexta", "13 de março"). Retorna formato curto pra título.
 */
function extractDate(text: string): string | null {
  const lower = text.toLowerCase();

  // 1. DD/MM ou DD/MM/AAAA — match direto, retorna como veio.
  const ddmm = lower.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (ddmm) return ddmm[1]!;

  // 2. Datas relativas
  if (/\bhoje\b/.test(lower)) return "hoje";
  if (/\bamanh[ãa]\b/.test(lower)) return "amanhã";
  if (/\bontem\b/.test(lower)) return "ontem";
  if (/\b(essa|esta)\s+semana\b/.test(lower)) return "esta semana";
  if (/\b(esse|este)\s+m[êe]s\b/.test(lower)) return "este mês";
  if (/\b(m[êe]s\s+passado)\b/.test(lower)) return "mês passado";

  // 3. Dias da semana
  const weekdays = [
    "segunda",
    "terça",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
    "sabado",
    "domingo",
  ];
  for (const d of weekdays) {
    if (new RegExp(`\\b${d}(-feira)?\\b`).test(lower)) {
      return d.replace("terca", "terça").replace("sabado", "sábado");
    }
  }

  // 4. "13 de março" / "13 março"
  const months: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    março: "03",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };
  const monthRe = new RegExp(
    `\\b(\\d{1,2})\\s+(?:de\\s+)?(${Object.keys(months).join("|")})\\b`,
    "i",
  );
  const m = lower.match(monthRe);
  if (m) {
    const day = m[1]!.padStart(2, "0");
    const mon = months[m[2]!.toLowerCase()]!;
    return `${day}/${mon}`;
  }

  return null;
}

/**
 * Extrai nome próprio (entidade) — heurística: palavra com inicial
 * maiúscula que NÃO é início de frase nem palavra do dicionário comum.
 *
 * Foca em padrões frequentes: "com o lead X", "do cliente Y", "no
 * tracking Z", "do workspace W", aspas, etc.
 */
function extractEntity(text: string): string | null {
  // Aspas explícitas (mais confiável)
  const quoted = text.match(/["'""]([^"'""]{2,40})["'""]/);
  if (quoted) return truncate(quoted[1]!, 24);

  // Padrões "<preposição/artigo> <nome>"
  const patterns = [
    /(?:com\s+(?:o|a)\s+(?:lead|cliente)\s+)([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u,
    /(?:do\s+(?:lead|cliente|workspace|tracking|projeto|cliente)\s+)([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u,
    /(?:no\s+(?:tracking|workspace|projeto|forge|nbox)\s+)([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u,
    /(?:para\s+(?:o|a)\s+(?:lead|cliente)\s+)([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u,
    /(?:pro?\s+(?:lead|cliente)\s+)([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return truncate(m[1]!, 24);
  }

  return null;
}

function truncate(s: string, max: number): string {
  s = s.trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Gera o título auto a partir da primeira mensagem do user.
 * Combina (app, data, entidade) com hífen — pula tokens nulos.
 */
export function generateAutoTitle(firstUserMessage: string): string {
  const text = firstUserMessage.trim();
  if (!text) return "Conversa com ASTRO";

  // 1. App
  let app: string | null = null;
  for (const { app: name, tokens } of APP_PATTERNS) {
    if (tokens.some((re) => re.test(text))) {
      app = name;
      break;
    }
  }

  // 2. Data
  const date = extractDate(text);

  // 3. Entidade
  const entity = extractEntity(text);

  const parts = [app, date, entity].filter((p): p is string => !!p);
  if (parts.length === 0) {
    // Fallback: primeiras 50 chars
    return truncate(text, 60);
  }
  return parts.join("-");
}
