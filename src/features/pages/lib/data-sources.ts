/**
 * Data sources do NASA Pages — registry central que cada elemento
 * `data-bound` consulta pra buscar dados reais do app.
 *
 * MVP: implementação client-side via hooks oRPC. Cada source declara
 * sua query e o shape do payload retornado. O renderer pega o source
 * pelo `kind` e mostra com o layout configurado.
 *
 * Próxima evolução: SSR-able versions (fetch durante build) pra
 * páginas publicadas terem dados embebidos no HTML estático.
 */
import type { DataSourceKind, DataBindingConfig } from "../types";

export interface DataSourceItem {
  /** ID estável do item — usado como key na listagem. */
  id: string;
  /** Título principal exibido no card/linha. */
  title: string;
  /** Subtítulo secundário (descrição, função, etc). */
  subtitle?: string;
  /** Valor numérico em destaque (preço, pontos, contagem). */
  value?: string | number;
  /** URL de imagem/avatar associada. */
  image?: string;
  /** Link de saída (opcional). */
  href?: string;
  /** Cor de acento (hex). */
  color?: string;
  /** Badges extras (planos, tags). */
  badges?: string[];
}

/**
 * Mock data por source — usado enquanto o builder está em modo edit
 * (sem conexão com banco) ou pra preview. Em runtime real, o
 * renderer substitui pelo dado vindo do oRPC.
 */
const MOCK_DATA: Record<DataSourceKind, DataSourceItem[]> = {
  "plans-list": [
    { id: "free", title: "Suit", value: "R$ 0", subtitle: "Gratuito" },
    { id: "earth", title: "Earth", value: "R$ 197", subtitle: "1.000★" },
    { id: "explore", title: "Explore", value: "R$ 397", subtitle: "3.000★", badges: ["Popular"] },
    { id: "constellation", title: "Constellation", value: "R$ 797", subtitle: "20.000★" },
  ],
  "nasa-route-courses": [
    { id: "1", title: "Vendas com IA", subtitle: "12 aulas · 3h", value: "R$ 297", image: "/placeholder-course.jpg" },
    { id: "2", title: "Closer Mastery", subtitle: "8 aulas · 2h", value: "R$ 197", image: "/placeholder-course.jpg" },
    { id: "3", title: "WhatsApp Ads", subtitle: "5 aulas · 1.5h", value: "Grátis", image: "/placeholder-course.jpg" },
  ],
  "space-points-leaderboard": [
    { id: "1", title: "Weydson Lima", subtitle: "Galaxy 2", value: "232 pts", image: "https://i.pravatar.cc/120?img=12" },
    { id: "2", title: "Arthur Fabrícyo", subtitle: "Galaxy 1", value: "214 pts", image: "https://i.pravatar.cc/120?img=33" },
    { id: "3", title: "João Gabriel", subtitle: "Galaxy 1", value: "213 pts", image: "https://i.pravatar.cc/120?img=15" },
    { id: "4", title: "Christyan Melo", subtitle: "Saturno", value: "150 pts", image: "https://i.pravatar.cc/120?img=58" },
  ],
  "org-stats": [
    { id: "leads", title: "Leads ativos", value: "1.247" },
    { id: "convs", title: "Conversas hoje", value: "89" },
    { id: "agendas", title: "Agendados", value: "23" },
    { id: "fechados", title: "Fechados no mês", value: "47" },
  ],
  "tag-counts": [
    { id: "1", title: "Novo Lead", value: 423, color: "#3b82f6" },
    { id: "2", title: "Qualificado", value: 187, color: "#10b981" },
    { id: "3", title: "Aguardando Pagamento", value: 89, color: "#f59e0b" },
    { id: "4", title: "Pago", value: 47, color: "#22c55e" },
  ],
};

/**
 * Labels visuais pra cada source — usado no properties panel.
 */
export const DATA_SOURCE_LABELS: Record<
  DataSourceKind,
  { label: string; description: string; icon: string }
> = {
  "plans-list": {
    label: "Lista de planos",
    description: "Mostra os planos da plataforma (preço, Stars, benefícios)",
    icon: "💎",
  },
  "nasa-route-courses": {
    label: "Cursos NASA Route",
    description: "Cursos publicados pela org (título, duração, preço)",
    icon: "🛰",
  },
  "space-points-leaderboard": {
    label: "Ranking Space Points",
    description: "Top membros por pontos (avatar, galáxia, pts)",
    icon: "🏆",
  },
  "org-stats": {
    label: "Estatísticas da org",
    description: "Números agregados em tempo real (leads, conversas)",
    icon: "📊",
  },
  "tag-counts": {
    label: "Contagem por tag",
    description: "Quantos leads em cada tag/etapa",
    icon: "🏷️",
  },
};

/**
 * Resolve um source → lista de items.
 * MVP: retorna mock. Quando integrado ao backend, troca por fetch
 * via oRPC com a query apropriada.
 */
export function resolveDataSource(
  config: DataBindingConfig,
): DataSourceItem[] {
  const items = MOCK_DATA[config.source] ?? [];
  const limit = config.limit ?? items.length;
  return items.slice(0, limit);
}
