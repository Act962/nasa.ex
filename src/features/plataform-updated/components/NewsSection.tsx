"use client";

import { motion } from "framer-motion";
import { Newspaper, Sparkles, Rocket, TrendingUp, Bell } from "lucide-react";

interface NewsItem {
  id: string;
  type: "news" | "feature" | "launch" | "update";
  title: string;
  description: string;
  date: string;
  tool?: string;
}

const newsItems: NewsItem[] = [
  {
    id: "1",
    type: "launch",
    title: "ASTRO 2.0 Lançado!",
    description:
      "Nova versão do assistente de IA com recursos avançados de análise e resposta contextual.",
    date: "Hoje",
    tool: "ASTRO",
  },
  {
    id: "2",
    type: "feature",
    title: "Novo Dashboard NERP",
    description:
      "Visualize métricas em tempo real com o novo painel de controle personalizado.",
    date: "Ontem",
    tool: "NERP",
  },
  {
    id: "3",
    type: "update",
    title: "NASACHAT: Integrações Ampliadas",
    description: "Agora com suporte a mais de 50 plataformas de comunicação.",
    date: "2 dias atrás",
    tool: "NASACHAT",
  },
  {
    id: "4",
    type: "news",
    title: "Webinar: Produtividade com N.A.S.A",
    description:
      "Aprenda a maximizar seus resultados usando as ferramentas N.A.S.A.",
    date: "Em breve",
  },
];

const getIcon = (type: NewsItem["type"]) => {
  switch (type) {
    case "news":
      return Newspaper;
    case "feature":
      return Sparkles;
    case "launch":
      return Rocket;
    case "update":
      return TrendingUp;
    default:
      return Bell;
  }
};

const getTypeLabel = (type: NewsItem["type"]) => {
  switch (type) {
    case "news":
      return "Notícia";
    case "feature":
      return "Novidade";
    case "launch":
      return "Lançamento";
    case "update":
      return "Atualização";
    default:
      return "Info";
  }
};

const NewsSection = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="w-full max-w-4xl mx-auto mt-8"
    >
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-foreground" />
        <h2 className="font-display text-lg font-bold tracking-wider text-foreground">
          Novidades N.A.S.A
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {newsItems.map((item, index) => {
          const Icon = getIcon(item.type);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="tool-card rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground bg-primary/30 px-2 py-0.5 rounded-full">
                      {getTypeLabel(item.type)}
                    </span>
                    {item.tool && (
                      <span className="text-xs text-muted-foreground">
                        {item.tool}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-base font-bold tracking-wide text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {item.date}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default NewsSection;
